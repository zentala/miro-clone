# Local backup and restore check

The backup contains a consistent SQLite snapshot and the asset files present beside that database. SQLite creates the snapshot with `VACUUM INTO`, so committed rows are included even when they were in the WAL. Asset files are content checked before they enter the archive. The archive has a versioned manifest and per-file SHA-256 values; a temporary artifact is verified before it is renamed to its dated final name.

Choose a local destination outside the application data directory and Git checkout. Do not use an off-box path here; that needs its own installation configuration. For example:

```sh
just backup /mnt/private-backups/miro-clone
just backup-verify /mnt/private-backups/miro-clone
```

`just backup` needs a nonempty database with board rows. A database with no `assets` table or no asset rows is valid when its boards have no asset references. A referenced asset must have both a registered row and intact bytes or the backup fails. It prints `unchanged, skipped` and creates no artifact when the staged SQLite snapshot and asset bytes match the newest valid snapshot. Each changed run has a UTC name such as `miro-clone-20261125T120000Z.mcb`; existing artifacts are never overwritten. A failed run removes only its own temporary artifact. After success or an unchanged skip, the command applies the shared grandfather-father-son retention policy: keep all 30 daily days, weekly copies for three months, then monthly copies forever.

`just backup-verify` chooses the newest dated artifact, validates its manifest and bytes, then extracts it under a newly created `miro-restore-test-<UTC>-*` directory in the system temporary area. It opens the restored SQLite database read-only, requires board rows, and checks each referenced asset row and file bytes. It removes only the directory it created, including when verification fails. A requested target root inside the live application data directory is refused before anything is extracted or removed. Pre-T04 databases without an `assets` table are read as having zero assets; backup and restore checks do not create or migrate that table.

`just backup-status <destination>` reports freshness. `just backup-prune <destination>` prints a retention plan without deleting files; only the regular `just backup <destination>` path applies retention.

The asset write protocol fsyncs the temporary file, renames it to its content-addressed path, then fsyncs both the asset shard and `assets/` directories before publishing its SQLite row. If the process stops before the row is published, a canonical file may be present without a database row. `unused` means a registered asset no board references; `unregistered` means an intact file on disk without a database row (for example, after an interrupted upload). Neither state is an error or deletable. The backup captures canonical asset files and intentionally excludes `.incoming` temporary uploads.

Before a real migration or replacement, take a fresh backup and run its restore check. A configured destination or an old artifact alone is not proof of a current, restorable backup. This task does not configure scheduling or off-box destinations.
