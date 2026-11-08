# Static checks plus the real synthetic critical browser workflow.
check:
    npm exec --no -- tsc --noEmit --incremental false
    npm run lint
    npm run build
    node --test --test-concurrency=1 tests/critical-editor.test.cjs
    node --test --test-concurrency=1 tests/miro-export.test.cjs
    node --test --test-concurrency=1 tests/packaging.test.cjs

# Disposable podman containers with synthetic data: packaging checks, then the
# critical browser workflow against a container of a temporary image.
container-check:
    #!/usr/bin/env bash
    set -euo pipefail
    npm run build
    MIRO_CONTAINER_TEST=1 node --test --test-concurrency=1 tests/packaging.test.cjs
    tag="localhost/miro-clone-critical:$(date +%s%N)"
    trap 'podman rmi --force "$tag" >/dev/null 2>&1 || true' EXIT
    podman build --quiet --tag "$tag" .
    # The first keep-id start of a new image prepares id-mapped layers (~30 s); do it outside the test's readiness wait.
    podman run --rm --userns=keep-id:uid=1000,gid=1000 "$tag" true
    MIRO_TEST_IMAGE="$tag" node --test --test-concurrency=1 tests/critical-editor.test.cjs
