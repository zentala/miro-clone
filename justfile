# Static checks plus the real synthetic critical browser workflow.
check:
    npm exec --no -- tsc --noEmit --incremental false
    npm run lint
    npm run build
    node --test --test-concurrency=1 tests/critical-editor.test.cjs
