# Static checks plus the real synthetic critical browser workflow.
check:
    npm exec --no -- tsc --noEmit --incremental false
    npm run lint
    npm run build
    node --test --test-concurrency=1 tests/critical-editor.test.cjs
    node --test --test-concurrency=1 tests/miro-export.test.cjs
    node --test --test-concurrency=1 tests/packaging.test.cjs

# Build and run a disposable container image (podman by default) with synthetic data.
container-check:
    npm run build
    MIRO_CONTAINER_TEST=1 node --test --test-concurrency=1 tests/packaging.test.cjs
