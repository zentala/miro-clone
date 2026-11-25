#!/usr/bin/env node
// Copied from Harness repository skills/backup/, revision 58be8c9.
// Backup retention for files named `<app>-<yyyymmddThhmmssZ>.<ext>`.
// Portable: Node 18+, no dependencies. Copy this file into an app repository.
//
//   node backup-retention.mjs prune  --app <app> --dir <abs-dir> [--apply] [options]
//   node backup-retention.mjs prune  --app <app> --listing <file|-> [options]
//   node backup-retention.mjs status --app <app> --dir <abs-dir> [--max-age-hours 36]
//   node backup-retention.mjs manifest (--source <abs-dir> [--dir <abs-dir>] | --revision <value>)
//   node backup-retention.mjs changed --app <app> --dir <abs-dir> (--source <abs-dir> | --revision <value>)
//
// Skip unchanged data: `manifest` prints the source's file list (path, size,
// mtime; no hashes) for the backup job to store as the `<app>-<ts>.manifest`
// sidecar; pass the same --dir as `changed` so a backup folder inside the
// source is left out. `changed` exits 0 when the source differs from the newest valid
// backup's manifest (take a backup), 3 when unchanged (skip; it records the
// check in `<app>.last-check`, which `status` counts as fresh).
//
// prune is a dry run unless --apply. With --listing it reads `name<TAB>size`
// lines (e.g. `find DIR -maxdepth 1 -type f -printf '%f\t%s\n'` run on a remote
// host), never deletes, and prints the names to delete, one per line, for the
// caller to remove on that host.
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = { dailyDays: 30, weeklyMonths: 3, monthlyMonths: 0, maxAgeHours: 36 };
const DAY = 86_400_000;
// A backup stamped further ahead than this is treated as a bad clock: invalid.
export const CLOCK_SKEW_MS = 3_600_000;
const isFuture = (group, now) => group.time > now + CLOCK_SKEW_MS;

function realOrNull(path) { try { return realpathSync(path); } catch { return null; } }

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Group entries ({ name, size }) into backups keyed by timestamp. */
export function groupBackups(app, entries) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(app)) throw new Error(`invalid app name: ${app}`);
  const pattern = new RegExp(`^${escape(app)}-(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z\\.(.+)$`);
  const groups = new Map();
  const ignored = [];
  for (const entry of entries) {
    const match = pattern.exec(entry.name);
    if (!match) { ignored.push(entry.name); continue; }
    const [, y, mo, d, h, mi, s] = match;
    const time = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    const date = new Date(time);
    if (date.getUTCMonth() !== +mo - 1 || date.getUTCDate() !== +d || +h > 23 || +mi > 59 || +s > 59) { ignored.push(entry.name); continue; }
    const stamp = `${y}${mo}${d}T${h}${mi}${s}Z`;
    if (!groups.has(stamp)) groups.set(stamp, { stamp, time, files: [] });
    groups.get(stamp).files.push(entry);
  }
  for (const group of groups.values()) {
    const payload = group.files.filter((file) => !/\.(tmp|partial|part|pinned|manifest)$/.test(file.name));
    group.pinned = group.files.some((file) => file.name.endsWith('.pinned'));
    // Empty or unfinished artifacts are failed backups: never counted, never kept as "newest good".
    group.valid = payload.length > 0 && payload.every((file) => Number.isSafeInteger(file.size) && file.size > 0);
  }
  return { groups: [...groups.values()].sort((a, b) => a.time - b.time), ignored };
}

function isoWeek(time) {
  const date = new Date(time);
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 3);
  const year = new Date(thursday).getUTCFullYear();
  return `${year}-W${Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY)) + 1}`;
}
const monthKey = (time) => { const d = new Date(time); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`; };
function monthsBefore(now, months) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

/**
 * Grandfather-father-son plan. Keeps every valid backup younger than dailyDays,
 * the first valid backup of each ISO week until weeklyMonths, then the first of
 * each calendar month (until monthlyMonths, 0 = forever). The newest valid and
 * pinned backups are always kept; invalid ones (empty, unfinished, or dated
 * more than CLOCK_SKEW_MS in the future) are reported and never deleted.
 */
export function planRetention(groups, now, options = {}) {
  const { dailyDays, weeklyMonths, monthlyMonths } = { ...DEFAULTS, ...options };
  if (!(dailyDays >= 1) || !(weeklyMonths >= 1 && weeklyMonths <= 12) || !(monthlyMonths >= 0)) {
    throw new Error('need dailyDays >= 1, weeklyMonths 1..12, monthlyMonths >= 0');
  }
  const dailyCut = now - dailyDays * DAY;
  const weeklyCut = Math.min(dailyCut, monthsBefore(now, weeklyMonths));
  const monthlyCut = monthlyMonths ? Math.min(weeklyCut, monthsBefore(now, monthlyMonths)) : -Infinity;
  const valid = groups.filter((group) => group.valid && !isFuture(group, now));
  const newest = valid.at(-1);
  const seen = new Set();
  const keep = [], remove = [], invalid = [];
  for (const group of groups) { // oldest first, so a bucket keeps its first backup
    if (!group.valid || isFuture(group, now)) { invalid.push({ ...group, reason: group.valid ? 'future' : 'invalid' }); continue; }
    let reason;
    if (group === newest) reason = 'newest';
    else if (group.pinned) reason = 'pinned';
    else if (group.time >= dailyCut) reason = 'daily';
    else if (group.time >= weeklyCut) { const key = `w:${isoWeek(group.time)}`; if (!seen.has(key)) { seen.add(key); reason = 'weekly'; } }
    else if (group.time >= monthlyCut) { const key = `m:${monthKey(group.time)}`; if (!seen.has(key)) { seen.add(key); reason = 'monthly'; } }
    (reason ? keep : remove).push({ ...group, reason: reason ?? 'thinned' });
  }
  return { keep, remove, invalid, newest };
}

/**
 * fresh: newest valid backup is within maxAgeHours and nothing is invalid.
 * attention: fresh, but invalid (empty, unfinished, future-dated) backups lie
 * around and need cleaning up. stale / missing: no recent valid backup.
 */
export function backupStatus(groups, now, maxAgeHours = DEFAULTS.maxAgeHours, lastCheck = null) {
  const usable = (group) => group.valid && !isFuture(group, now);
  const invalid = groups.filter((group) => !usable(group)).flatMap((group) => group.files.map((file) => file.name));
  const newest = groups.filter(usable).at(-1);
  if (!newest) return { status: 'missing', newest: null, ageHours: null, invalid, checkedHours: null };
  const hours = (time) => Math.round(((now - time) / 3_600_000) * 10) / 10;
  const ageHours = hours(newest.time);
  // A recent "unchanged since <newest>" check counts as fresh: quiet data adds no copies.
  const checked = lastCheck && lastCheck.unchangedSince === newest.stamp && Number.isFinite(lastCheck.checkedAt) && lastCheck.checkedAt <= now + CLOCK_SKEW_MS ? lastCheck.checkedAt : null;
  const checkedHours = checked === null ? null : hours(checked);
  const recent = ageHours <= maxAgeHours || (checkedHours !== null && checkedHours <= maxAgeHours);
  const status = !recent ? 'stale' : invalid.length ? 'attention' : 'fresh';
  return { status, newest: newest.stamp, ageHours, invalid, checkedHours };
}

const MANIFEST_HEADER = '# backup-manifest v2';

/**
 * Cheap change fingerprint: one `path<TAB>type<TAB>mode<TAB>size<TAB>mtimeMs`
 * line per directory, file or link under `source`, sorted. No content hashing.
 * Directories carry only their mode (their mtime moves with transient files).
 * The backup directory `dir` is left out when it lies inside the source, so
 * writing a backup or a last-check never looks like a change. With `revision`
 * (an app's own change counter) the manifest is that value alone.
 */
export function sourceManifest({ source, revision, dir: backupDir }) {
  if (revision !== undefined) return `${MANIFEST_HEADER}\nrevision\t${revision}\n`;
  const exclude = backupDir === undefined ? null : realOrNull(backupDir);
  if (exclude !== null && exclude === realOrNull(source)) throw new Error('--dir must not be the --source directory itself');
  const lines = [];
  const mode = (stat) => (stat.mode & 0o7777).toString(8);
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = lstatSync(path);
      const rel = relative(source, path).split('\\').join('/');
      if (stat.isDirectory()) {
        if (exclude !== null && realOrNull(path) === exclude) continue;
        lines.push(`${rel}\tdir\t${mode(stat)}\t-\t-`);
        walk(path);
      }
      else if (stat.isSymbolicLink()) lines.push(`${rel}\tlink\t-\t${readlinkSync(path)}\t${Math.trunc(stat.mtimeMs)}`);
      else if (stat.isFile()) lines.push(`${rel}\tfile\t${mode(stat)}\t${stat.size}\t${Math.trunc(stat.mtimeMs)}`);
    }
  };
  walk(source);
  lines.sort();
  return `${MANIFEST_HEADER}\n${lines.map((line) => `${line}\n`).join('')}`;
}

const isManifest = (name) => /\.manifest$/.test(name);
export const lastCheckPath = (dir, app) => join(dir, `${app}.last-check`);

export function readLastCheck(dir, app) {
  try { return JSON.parse(readFileSync(lastCheckPath(dir, app), 'utf8')); } catch { return null; }
}

export function readDirectory(dir) {
  return readdirSync(dir).flatMap((name) => {
    const stat = lstatSync(join(dir, name));
    return stat.isFile() ? [{ name, size: stat.size }] : []; // links and directories are never touched
  });
}

export function parseListing(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    const tab = line.lastIndexOf('\t');
    if (tab < 1) throw new Error(`listing line is not "name<TAB>size": ${line}`);
    return { name: line.slice(0, tab), size: Number(line.slice(tab + 1)) };
  });
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  const numbers = { '--daily-days': 'dailyDays', '--weekly-months': 'weeklyMonths', '--monthly-months': 'monthlyMonths', '--max-age-hours': 'maxAgeHours' };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === '--apply' || flag === '--json') { options[flag.slice(2)] = true; continue; }
    const value = rest[++i];
    if (value === undefined) throw new Error(`missing value for ${flag}`);
    if (numbers[flag]) {
      if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`${flag} needs a non-negative number, got: ${value}`);
      options[numbers[flag]] = Number(value);
    }
    else if (flag === '--app') options.app = value;
    else if (flag === '--dir') options.dir = value;
    else if (flag === '--listing') options.listing = value;
    else if (flag === '--source') options.source = value;
    else if (flag === '--revision') options.revision = value;
    else if (flag === '--now') options.now = Date.parse(value);
    else throw new Error(`unknown option: ${flag}`);
  }
  return options;
}

const USAGE = 'usage: backup-retention.mjs prune|status|changed --app <app> (--dir <abs-dir> | --listing <file|->) [--apply] [--daily-days 30] [--weekly-months 3] [--monthly-months 0] [--max-age-hours 36] [--now <iso>] [--json]; manifest|changed take --source <abs-dir> or --revision <value>';

export function main(argv, io = { out: console.log, err: console.error }) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.command === 'manifest' || options.command === 'changed') {
      if ((options.source === undefined) === (options.revision === undefined)) throw new Error('pass exactly one of --source or --revision');
      if (options.source !== undefined && !isAbsolute(options.source)) throw new Error('--source must be absolute');
      if (options.revision === '') throw new Error('--revision must not be empty');
    }
    if (options.command === 'manifest') {
      if (options.dir !== undefined && !isAbsolute(options.dir)) throw new Error('--dir must be absolute');
      try { io.out(sourceManifest(options).trimEnd()); return 0; } catch (error) { io.err(error.message); return 64; }
    }
    if (!['prune', 'status', 'changed'].includes(options.command) || !options.app) throw new Error(USAGE);
    if (options.command === 'changed' && options.listing) throw new Error('changed needs --dir');
    if (!!options.dir === !!options.listing) throw new Error('pass exactly one of --dir or --listing');
    if (options.dir && !isAbsolute(options.dir)) throw new Error('--dir must be absolute');
    if (options.listing && options.apply) throw new Error('--apply works only with --dir; delete listed names on their host');
    if (options.now !== undefined && !Number.isFinite(options.now)) throw new Error('--now must be an ISO date');
  } catch (error) { io.err(error.message); return 64; }
  const now = options.now ?? Date.now();
  let groups, ignored, plan;
  try {
    const entries = options.dir ? readDirectory(options.dir) : parseListing(readFileSync(options.listing === '-' ? 0 : resolve(options.listing), 'utf8'));
    ({ groups, ignored } = groupBackups(options.app, entries));
    if (options.command === 'prune') plan = planRetention(groups, now, options);
  } catch (error) { io.err(error.message); return 64; }

  if (options.command === 'changed') return changed(options, groups, now, io);

  if (options.command === 'status') {
    const result = backupStatus(groups, now, options.maxAgeHours, options.dir ? readLastCheck(options.dir, options.app) : null);
    const checked = result.checkedHours === null ? '' : ` unchanged, checked ${result.checkedHours}h ago`;
    io.out(options.json ? JSON.stringify(result) : `${result.status} ${result.newest ?? '-'} ${result.ageHours ?? '-'}h${checked} invalid ${result.invalid.length}`);
    if (!options.json) for (const name of result.invalid) io.out(`  ! invalid (fix the backup job, then remove): ${name}`);
    return result.status === 'fresh' ? 0 : 1;
  }

  if (!plan.newest) { io.err(`no valid ${options.app} backup found; nothing deleted`); return 1; }
  const names = (list) => list.flatMap((group) => group.files.map((file) => file.name));
  if (options.listing && !options.json) { for (const name of names(plan.remove)) io.out(name); return 0; }
  if (options.apply) for (const name of names(plan.remove)) unlinkSync(join(options.dir, name));
  const summary = {
    mode: options.apply ? 'apply' : 'dry-run',
    kept: plan.keep.map((group) => ({ stamp: group.stamp, reason: group.reason })),
    deleted: names(plan.remove),
    invalid: names(plan.invalid),
    ignored,
  };
  if (options.json) io.out(JSON.stringify(summary));
  else {
    io.out(`${summary.mode}: keep ${summary.kept.length}, ${options.apply ? 'deleted' : 'would delete'} ${plan.remove.length} backup(s), invalid ${plan.invalid.length}`);
    for (const name of summary.deleted) io.out(`  - ${name}`);
    for (const name of summary.invalid) io.out(`  ! invalid (kept, fix the backup job): ${name}`);
  }
  return 0;
}

function changed(options, groups, now, io) {
  let current;
  try { current = sourceManifest(options); } catch (error) { io.err(error.message); return 64; }
  const newest = groups.filter((group) => group.valid && !isFuture(group, now)).at(-1);
  const sidecar = newest?.files.find((file) => isManifest(file.name));
  let previous = null;
  if (sidecar) { try { previous = readFileSync(join(options.dir, sidecar.name), 'utf8'); } catch { previous = null; } }
  if (previous === null || previous.trimEnd() !== current.trimEnd()) {
    io.out(newest ? (sidecar ? `changed since ${newest.stamp}` : `no manifest beside ${newest.stamp}; back up`) : 'no valid backup; back up');
    return 0;
  }
  const target = lastCheckPath(options.dir, options.app);
  try {
    writeFileSync(`${target}.tmp`, `${JSON.stringify({ checkedAt: now, unchangedSince: newest.stamp })}\n`);
    renameSync(`${target}.tmp`, target);
  } catch (error) { io.err(error.message); return 64; }
  io.out(`unchanged since ${newest.stamp}, skipped`);
  return 3;
}

// Node reports import.meta.url as the real path; argv[1] keeps a symlinked
// path (e.g. a `current` release link). Compare real paths on both sides.
if (process.argv[1] && realOrNull(process.argv[1]) === realOrNull(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
