# QA Plan

Status: IMPLEMENTED

Required checks:

- `npm run check`
- `npm test`
- `npm pack --dry-run`
- `node scripts/qa-import.mjs`
- `node scripts/qa-status-scope.mjs`
- `node scripts/qa-child-tools.mjs`
- `node scripts/qa-process-kill.mjs`
- `node scripts/qa-senpi-install.mjs --dry-run`
- local senpi extension import and install dry-run
- direct process-kill simulation for process mode
- module-level import smoke through `jiti`
- direct module-level TUI status scoping simulation
- direct module-level child tool allowlist and non-persistent in-process session simulation

Evidence is captured under `evidence/` and summarized in [qa-results.md](qa-results.md).
