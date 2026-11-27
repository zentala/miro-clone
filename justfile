# Static checks plus the real synthetic critical browser workflow.
check:
    npm exec --no -- tsc --noEmit --incremental false
    npm run lint
    npm run build
    node --test --test-concurrency=1 tests/critical-editor.test.cjs
    node --test --test-concurrency=1 tests/code-blocks.test.cjs
    node --test --test-concurrency=1 tests/miro-export.test.cjs
    node --test --test-concurrency=1 tests/packaging.test.cjs
    node --test --test-concurrency=1 tests/document-model.test.cjs
    node --test --test-concurrency=1 tests/locks.test.cjs
    node --test --test-concurrency=1 tests/frames.test.cjs
    node --test --test-concurrency=1 tests/image-workflow.test.cjs
    node --test --test-concurrency=1 tests/product-cards.test.cjs
    node --test --test-concurrency=1 tests/progressive-images.test.cjs
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-concurrency=1 tests/migration-normalize.test.cjs
    node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-concurrency=1 tests/migration-import.test.cjs
    node --test --test-concurrency=1 tests/assets.test.cjs
    node --test --test-concurrency=1 tests/backup-restore.test.cjs
    node --test --test-concurrency=1 scripts/backup-retention.test.mjs
    node --test --test-concurrency=1 tests/board-store.test.cjs
    node --test --test-concurrency=1 tests/navigation-capacity.test.cjs
    node --test --test-concurrency=1 tests/rich-text.test.cjs
    node tests/capacity/selector-regression.cjs

# Browser capacity measurement for the T01 workload matrix (slow; not part of check).
# Example: just measure-capacity --workloads=2000 --viewports=1920x1080 --dprs=2
measure-capacity *args:
    npm run build
    node tests/capacity/measure-capacity.cjs {{args}}

# Disposable podman containers with synthetic data: packaging checks, then the
# critical browser workflow against a container of a temporary image.
container-check:
    #!/usr/bin/env bash
    set -euo pipefail
    lock_file="${TMPDIR:-/tmp}/miro-clone-container-check.lock"
    exec 9>"$lock_file"
    if ! flock -n 9; then
        echo "Another container-check is running; waiting for the lock."
        flock 9
    fi
    npm run build
    node --test --test-concurrency=1 tests/packaging.test.cjs
    tag="localhost/miro-clone-critical:$(date +%s%N)"
    trap 'podman rmi --force "$tag" >/dev/null 2>&1 || true' EXIT
    # Do not retain intermediate layer images; the trap owns only this unique final tag.
    podman build --layers=false --rm --quiet --tag "$tag" .
    podman run --rm "$tag" node --version
    # The first keep-id start of a new image prepares id-mapped layers (~30 s); do it outside the test's readiness wait.
    podman run --rm --userns=keep-id:uid=1000,gid=1000 "$tag" true
    MIRO_TEST_IMAGE="$tag" node --test --test-concurrency=1 tests/critical-editor.test.cjs

# Validate a structural Miro export and print its loss report; changes no board.
migration-dry-run export *args:
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/migration/dry-run.mjs "{{export}}" {{args}}

# Import a reviewed v1 package; local image originals are supplied explicitly.
migration-import package *args:
    node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/migration/import.mjs --package "{{package}}" {{args}}

# List or resume interrupted synthetic/package imports from their SQLite ledger.
migration-import-recovery *args:
    node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/migration/import.mjs {{args}}

# Create a verified SQLite-plus-assets snapshot in the chosen local directory.
backup destination:
    node scripts/backup.mjs --destination "{{destination}}"
    node scripts/backup-retention.mjs prune --app miro-clone --dir "{{destination}}" --apply

# Restore the newest snapshot into a dated temporary directory and remove it.
backup-verify destination:
    node scripts/restore-test.mjs --directory "{{destination}}"

# Report status or show a retention plan for a selected destination.
backup-status destination:
    node scripts/backup-retention.mjs status --app miro-clone --dir "{{destination}}" --max-age-hours 36

backup-prune destination:
    node scripts/backup-retention.mjs prune --app miro-clone --dir "{{destination}}"
