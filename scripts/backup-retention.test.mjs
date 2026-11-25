#!/usr/bin/env node
// Copied from Harness repository skills/backup/, revision 58be8c9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { backupStatus, groupBackups, main, parseListing, planRetention, sourceManifest } from './backup-retention.mjs';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-18T03:30:00Z');
const stamp = (time) => new Date(time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// One nightly at 03:00 UTC for `days` days back from NOW.
const nightlies = (days, app = 'demo') => Array.from({ length: days }, (_, i) => ({ name: `${app}-${stamp(Date.parse('2026-10-18T03:00:00Z') - i * DAY)}.tar.gz`, size: 100 }));
const run = (argv) => { const out = [], err = []; const code = main(argv, { out: (l) => out.push(l), err: (l) => err.push(l) }); return { code, out, err }; };

test('a year of nightlies thins to 30 daily, weekly to 3 months, then monthly', () => {
  const { groups } = groupBackups('demo', nightlies(365));
  const plan = planRetention(groups, NOW);
  const by = (reason) => plan.keep.filter((g) => g.reason === reason).length;
  assert.equal(by('newest') + by('daily'), 30); // every nightly younger than 30 days
  assert.ok(by('weekly') >= 8 && by('weekly') <= 10, `weekly ${by('weekly')}`);
  assert.ok(by('monthly') >= 9 && by('monthly') <= 10, `monthly ${by('monthly')}`);
  assert.equal(plan.keep.length + plan.remove.length, 365);
  // No two kept weekly backups share an ISO week; no two monthly share a month.
  const months = plan.keep.filter((g) => g.reason === 'monthly').map((g) => g.stamp.slice(0, 6));
  assert.equal(new Set(months).size, months.length);
});

test('thinning is stable: a backup kept by one run is not deleted by the next day unless it changes tier', () => {
  const entries = nightlies(200);
  const first = planRetention(groupBackups('demo', entries).groups, NOW);
  const survivors = entries.filter((e) => first.keep.some((g) => g.files.includes(e)));
  const second = planRetention(groupBackups('demo', survivors).groups, NOW + DAY);
  const removed = second.remove.map((g) => g.stamp);
  // Only daily-tier backups crossing into the weekly tier may go.
  for (const s of removed) assert.ok(Date.parse(s.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')) < NOW - 29 * DAY, s);
});

test('the newest valid backup is kept even when it is old, and empty or partial files never count', () => {
  const old = Date.parse('2025-01-05T03:00:00Z');
  const entries = [
    { name: `demo-${stamp(old)}.sql.gz`, size: 10 },
    { name: `demo-${stamp(old + DAY)}.sql.gz`, size: 10 },
    { name: `demo-${stamp(NOW - DAY)}.sql.gz`, size: 0 },
    { name: `demo-${stamp(NOW - 2 * DAY)}.sql.gz.tmp`, size: 50 },
  ];
  const plan = planRetention(groupBackups('demo', entries).groups, NOW);
  assert.equal(plan.newest.stamp, stamp(old + DAY));
  assert.deepEqual(plan.keep.map((g) => g.reason), ['monthly', 'newest']);
  assert.equal(plan.invalid.length, 2);
  assert.equal(plan.remove.length, 0);
});

test('sidecars share their backup, .pinned keeps it, foreign names are ignored', () => {
  const t = Date.parse('2026-01-14T03:00:00Z');
  const entries = [
    { name: `demo-${stamp(t - DAY)}.db`, size: 5 },
    { name: `demo-${stamp(t)}.db`, size: 5 },
    { name: `demo-${stamp(t)}.db.json`, size: 2 },
    { name: `demo-${stamp(t)}.pinned`, size: 0 },
    { name: `demo-${stamp(NOW)}.db`, size: 5 },
    { name: 'demo-latest.db', size: 5 },
    { name: `other-${stamp(t)}.db`, size: 5 },
    { name: 'demo-20261399T000000Z.db', size: 5 },
  ];
  const { groups, ignored } = groupBackups('demo', entries);
  assert.deepEqual(ignored.sort(), ['demo-20261399T000000Z.db', 'demo-latest.db', `other-${stamp(t)}.db`].sort());
  const plan = planRetention(groups, NOW);
  assert.equal(plan.keep.find((g) => g.stamp === stamp(t)).reason, 'pinned');
  assert.equal(plan.keep.find((g) => g.stamp === stamp(t)).files.length, 3);
});

test('options are validated and monthly retention can be capped', () => {
  const { groups } = groupBackups('demo', nightlies(400));
  assert.throws(() => planRetention(groups, NOW, { weeklyMonths: 13 }));
  assert.throws(() => planRetention(groups, NOW, { dailyDays: 0 }));
  const capped = planRetention(groups, NOW, { monthlyMonths: 6 });
  assert.ok(capped.keep.every((g) => g.reason !== 'monthly' || g.time >= Date.parse('2026-04-18T00:00:00Z')));
  assert.throws(() => groupBackups('../x', []));
});

test('status reports fresh, stale and missing', () => {
  assert.equal(backupStatus(groupBackups('demo', nightlies(3)).groups, NOW).status, 'fresh');
  assert.equal(backupStatus(groupBackups('demo', nightlies(3)).groups, NOW + 3 * DAY).status, 'stale');
  assert.equal(backupStatus(groupBackups('demo', [{ name: `demo-${stamp(NOW)}.db`, size: 0 }]).groups, NOW).status, 'missing');
});

test('CLI: dry run deletes nothing, --apply deletes only the planned files, links are never touched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    for (const entry of nightlies(120)) writeFileSync(join(dir, entry.name), 'x'.repeat(entry.size));
    writeFileSync(join(dir, 'README.txt'), 'keep');
    mkdirSync(join(dir, 'demo-20250101T000000Z.dir'));
    symlinkSync(join(dir, 'README.txt'), join(dir, 'demo-20250102T000000Z.tar.gz'));
    const before = readdirSync(dir).length;
    const dry = run(['prune', '--app', 'demo', '--dir', dir, '--now', new Date(NOW).toISOString(), '--json']);
    assert.equal(dry.code, 0);
    const plan = JSON.parse(dry.out[0]);
    assert.equal(plan.mode, 'dry-run');
    assert.ok(plan.deleted.length > 0);
    assert.equal(readdirSync(dir).length, before);
    const applied = run(['prune', '--app', 'demo', '--dir', dir, '--now', new Date(NOW).toISOString(), '--apply', '--json']);
    assert.equal(applied.code, 0);
    assert.deepEqual(JSON.parse(applied.out[0]).deleted, plan.deleted);
    const left = readdirSync(dir);
    assert.equal(left.length, before - plan.deleted.length);
    for (const name of ['README.txt', 'demo-20250101T000000Z.dir', 'demo-20250102T000000Z.tar.gz']) assert.ok(left.includes(name), name);
    assert.equal(run(['status', '--app', 'demo', '--dir', dir, '--now', new Date(NOW).toISOString()]).code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: listing mode prints names to delete and refuses --apply; bad input exits 64; no valid backup exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    const listing = join(dir, 'listing.tsv');
    writeFileSync(listing, nightlies(60).map((e) => `${e.name}\t${e.size}`).join('\n') + '\n');
    const listed = run(['prune', '--app', 'demo', '--listing', listing, '--now', new Date(NOW).toISOString()]);
    assert.equal(listed.code, 0);
    assert.ok(listed.out.length > 0 && listed.out.every((l) => /^demo-\d{8}T\d{6}Z\.tar\.gz$/.test(l)));
    assert.equal(run(['prune', '--app', 'demo', '--listing', listing, '--apply']).code, 64);
    assert.equal(run(['prune', '--app', 'demo', '--dir', 'relative']).code, 64);
    assert.equal(run(['prune', '--dir', dir]).code, 64);
    assert.equal(run(['prune', '--app', 'nothing', '--dir', dir]).code, 1);
    assert.throws(() => parseListing('no-tab-here\n'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a future-dated backup (bad clock) is invalid: never newest, never fresh, never deleted', () => {
  const future = NOW + 2 * 365 * DAY;
  const entries = [...nightlies(40), { name: `demo-${stamp(future)}.tar.gz`, size: 100 }];
  const plan = planRetention(groupBackups('demo', entries).groups, NOW);
  assert.equal(plan.newest.stamp, stamp(Date.parse('2026-10-18T03:00:00Z')));
  assert.deepEqual(plan.invalid.map((g) => [g.stamp, g.reason]), [[stamp(future), 'future']]);
  assert.ok(!plan.remove.some((g) => g.stamp === stamp(future)));
  const only = backupStatus(groupBackups('demo', [{ name: `demo-${stamp(future)}.tar.gz`, size: 100 }]).groups, NOW);
  assert.equal(only.status, 'missing');
  assert.deepEqual(only.invalid, [`demo-${stamp(future)}.tar.gz`]);
  // Within the clock-skew allowance a backup still counts.
  const skewed = backupStatus(groupBackups('demo', [{ name: `demo-${stamp(NOW + 10 * 60_000)}.db`, size: 1 }]).groups, NOW);
  assert.equal(skewed.status, 'fresh');
});

test('status reports leftover .tmp and empty backups as attention instead of fresh', () => {
  const entries = [...nightlies(3), { name: `demo-${stamp(NOW - 5 * DAY)}.tar.gz.tmp`, size: 9 }, { name: `demo-${stamp(NOW - 6 * DAY)}.tar.gz`, size: 0 }];
  const result = backupStatus(groupBackups('demo', entries).groups, NOW);
  assert.equal(result.status, 'attention');
  assert.equal(result.invalid.length, 2);
  const dir = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    for (const entry of entries) writeFileSync(join(dir, entry.name), 'x'.repeat(entry.size));
    const cli = run(['status', '--app', 'demo', '--dir', dir, '--now', new Date(NOW).toISOString()]);
    assert.equal(cli.code, 1);
    assert.match(cli.out[0], /^attention .* invalid 2$/);
    assert.equal(cli.out.filter((line) => line.includes('! invalid')).length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI input errors print one message and exit 64 without a stack trace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    const cases = [
      ['prune', '--app', '../bad', '--dir', dir],
      ['status', '--app', 'demo', '--dir', join(dir, 'missing')],
      ['prune', '--app', 'demo', '--dir', dir, '--daily-days', 'abc'],
      ['prune', '--app', 'demo', '--dir', dir, '--weekly-months', 'x'],
      ['prune', '--app', 'demo', '--dir', dir, '--weekly-months', '13'],
      ['status', '--app', 'demo', '--dir', dir, '--max-age-hours', 'soon'],
      ['prune', '--app', 'demo', '--dir', dir, '--now', 'yesterday'],
    ];
    for (const argv of cases) {
      const result = run(argv);
      assert.equal(result.code, 64, argv.join(' '));
      assert.equal(result.err.length, 1, argv.join(' '));
      assert.doesNotMatch(result.err[0], /\n\s+at /);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('invoked through a symlinked path (release link), the CLI still runs and thins', { skip: process.platform === 'win32' && 'symlinks need privileges on Windows' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    const release = join(root, 'releases', 'r1'); mkdirSync(release, { recursive: true });
    const script = fileURLToPath(new URL('./backup-retention.mjs', import.meta.url));
    writeFileSync(join(release, 'backup-retention.mjs'), readFileSync(script));
    symlinkSync(release, join(root, 'current'));
    const data = join(root, 'data'); mkdirSync(data);
    for (const entry of nightlies(90)) writeFileSync(join(data, entry.name), 'x'.repeat(entry.size));
    const args = ['prune', '--app', 'demo', '--dir', data, '--now', new Date(NOW).toISOString(), '--apply', '--json'];
    for (const via of [join(root, 'current', 'backup-retention.mjs'), join(root, 'linked.mjs')]) {
      if (via.endsWith('linked.mjs')) symlinkSync(join(release, 'backup-retention.mjs'), via);
      const run = spawnSync(process.execPath, [via, ...args], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(JSON.parse(run.stdout).mode, 'apply', `no output via ${via}`);
    }
    assert.ok(readdirSync(data).length < 90);
    const usage = spawnSync(process.execPath, [join(root, 'current', 'backup-retention.mjs')], { encoding: 'utf8' });
    assert.equal(usage.status, 64);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unchanged data is skipped: changed exits 0 on new or changed data, 3 when unchanged, and records the check', () => {
  const root = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    const source = join(root, 'library'); mkdirSync(join(source, 'covers'), { recursive: true });
    writeFileSync(join(source, 'library.db'), 'rows');
    writeFileSync(join(source, 'covers', 'a.jpg'), 'img');
    const dir = join(root, 'backups'); mkdirSync(dir);
    const at = (time) => ['--now', new Date(time).toISOString()];
    const changed = (time) => run(['changed', '--app', 'demo', '--dir', dir, '--source', source, ...at(time)]);
    // No backup yet: back up.
    assert.equal(changed(NOW).code, 0);
    // The job takes a backup and stores the manifest beside it.
    const first = stamp(NOW);
    writeFileSync(join(dir, `demo-${first}.tar.gz`), 'data');
    const manifest = run(['manifest', '--source', source]);
    assert.equal(manifest.code, 0);
    writeFileSync(join(dir, `demo-${first}.manifest`), `${manifest.out.join('\n')}\n`);
    assert.ok(!/[0-9a-f]{40}/.test(manifest.out.join('\n')), 'manifest holds no hashes');
    // Nothing changed 40 days later: skip, record the check, status stays fresh.
    const later = NOW + 40 * DAY;
    const skip = changed(later);
    assert.equal(skip.code, 3);
    assert.match(skip.out[0], /unchanged since .*skipped/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'demo.last-check'), 'utf8')), { checkedAt: later, unchangedSince: first });
    const status = run(['status', '--app', 'demo', '--dir', dir, ...at(later + 3_600_000)]);
    assert.equal(status.code, 0, status.out.join('\n'));
    assert.match(status.out[0], /^fresh .*unchanged, checked 1h ago/);
    // The skipped check itself goes stale when the job stops running.
    assert.equal(run(['status', '--app', 'demo', '--dir', dir, ...at(later + 2 * DAY)]).code, 1);
    // A modified, added or removed file is a change.
    utimesSync(join(source, 'library.db'), new Date(later), new Date(later));
    assert.equal(changed(later).code, 0);
    writeFileSync(join(dir, `demo-${first}.manifest`), sourceManifest({ source }));
    assert.equal(changed(later).code, 3);
    writeFileSync(join(source, 'covers', 'b.jpg'), 'img');
    assert.equal(changed(later).code, 0);
    rmSync(join(source, 'covers', 'b.jpg'));
    assert.equal(changed(later).code, 3);
    // An app's own revision counter works the same way, and the manifest sidecar never counts as a backup.
    writeFileSync(join(dir, `demo-${first}.manifest`), sourceManifest({ revision: '42' }));
    assert.equal(run(['changed', '--app', 'demo', '--dir', dir, '--revision', '42', ...at(later)]).code, 3);
    assert.equal(run(['changed', '--app', 'demo', '--dir', dir, '--revision', '43', ...at(later)]).code, 0);
    assert.equal(groupBackups('demo', [{ name: `demo-${first}.manifest`, size: 30 }]).groups[0].valid, false);
    // Bad input exits 64.
    assert.equal(run(['changed', '--app', 'demo', '--dir', dir, ...at(later)]).code, 64);
    assert.equal(run(['manifest', '--source', 'relative']).code, 64);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a last-check for an older backup, or from the future, does not make status fresh', () => {
  const { groups } = groupBackups('demo', nightlies(1));
  const later = NOW + 10 * DAY;
  assert.equal(backupStatus(groups, later, 36, { checkedAt: later, unchangedSince: '20200101T000000Z' }).status, 'stale');
  assert.equal(backupStatus(groups, later, 36, { checkedAt: later + 5 * DAY, unchangedSince: groups[0].stamp }).status, 'stale');
  assert.equal(backupStatus(groups, later, 36, { checkedAt: later, unchangedSince: groups[0].stamp }).status, 'fresh');
});

test('quiet data: long gaps between backups keep every monthly copy forever and the newest one', () => {
  // One backup per change, months apart, over three years.
  const times = ['2023-11-02', '2024-06-10', '2024-06-20', '2025-08-01', '2026-02-14'].map((d) => Date.parse(`${d}T03:00:00Z`));
  const plan = planRetention(groupBackups('demo', times.map((t) => ({ name: `demo-${stamp(t)}.tar.gz`, size: 9 }))).groups, NOW);
  assert.deepEqual(plan.keep.map((g) => g.reason), ['monthly', 'monthly', 'monthly', 'newest']);
  assert.deepEqual(plan.remove.map((g) => g.stamp), [stamp(times[2])]); // second copy of June 2024 only
});

test('a backup folder inside the source is left out of the manifest, so skipping still works', () => {
  const source = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    writeFileSync(join(source, 'library.db'), 'rows');
    const dir = join(source, '.backups', 'demo'); mkdirSync(dir, { recursive: true });
    const at = ['--now', new Date(NOW).toISOString()];
    const first = stamp(NOW);
    const manifest = run(['manifest', '--source', source, '--dir', dir]);
    assert.equal(manifest.code, 0, manifest.err.join('\n'));
    assert.ok(!manifest.out.join('\n').includes('.backups/demo'), 'backup folder excluded');
    writeFileSync(join(dir, `demo-${first}.tar.gz`), 'data');
    writeFileSync(join(dir, `demo-${first}.manifest`), `${manifest.out.join('\n')}\n`);
    const changed = () => run(['changed', '--app', 'demo', '--dir', dir, '--source', source, ...at]).code;
    assert.equal(changed(), 3);
    assert.equal(changed(), 3, 'the last-check written by the first skip is not a change');
    writeFileSync(join(dir, `demo-${stamp(NOW - DAY)}.tar.gz`), 'older'); // more backups are not a change
    assert.equal(changed(), 3);
    writeFileSync(join(source, 'library.db'), 'more rows');
    assert.equal(changed(), 0);
    // The backup folder may not be the source itself.
    assert.equal(run(['manifest', '--source', source, '--dir', source]).code, 64);
  } finally { rmSync(source, { recursive: true, force: true }); }
});

test('the manifest records directories and file modes: a new empty folder or a chmod is a change', { skip: process.platform === 'win32' && 'POSIX modes' }, () => {
  const source = mkdtempSync(join(tmpdir(), 'backup-retention-'));
  try {
    writeFileSync(join(source, 'a.txt'), 'a');
    const before = sourceManifest({ source });
    mkdirSync(join(source, 'empty'));
    const withDir = sourceManifest({ source });
    assert.notEqual(withDir, before);
    assert.match(withDir, /^empty\tdir\t\d+\t-\t-$/m);
    const mtime = new Date(NOW);
    utimesSync(join(source, 'a.txt'), mtime, mtime);
    const sameMode = sourceManifest({ source });
    chmodSync(join(source, 'a.txt'), 0o600);
    utimesSync(join(source, 'a.txt'), mtime, mtime);
    assert.notEqual(sourceManifest({ source }), sameMode);
    assert.match(sourceManifest({ source }), /^a\.txt\tfile\t600\t1\t/m);
  } finally { rmSync(source, { recursive: true, force: true }); }
});
