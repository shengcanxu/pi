# QA Results

Status: PASSED

Command-backed evidence from May 17, 2026:

- `npm test`: passed, 21 files / 65 tests.
- `npm run check`: passed, `tsgo --noEmit` and `biome check .`.
- `bun --install=fallback /Users/yeongyu/.config/opencode/skills/typescript-programmer/scripts/check-no-excuse-rules.ts src test scripts`: passed, no no-excuse violations across 53 files.
- LSP diagnostics: passed, 49 TypeScript files scanned, 0 diagnostics.
- `npm run qa:import`: passed, `import ok`.
- `npm run qa:status-scope`: passed, `status scope ok`.
- `npm run qa:child-tools`: passed, `child tools ok`.
- `npm run qa:process-kill`: passed, child pid was reported and direct `SIGTERM` produced `killed`.
- `npm run qa:senpi-install`: passed dry-run for `~/.senpi/agent/extensions/pi-task`.
- `node scripts/qa-senpi-install.mjs --force`: passed, local symlink installed to `~/.senpi/agent/extensions/pi-task`.
- `readlink ~/.senpi/agent/extensions/pi-task`: passed, points to `/Users/yeongyu/local-workspaces/pi-extensions/pi-task`.
- `senpi --help`: passed, host exposes `--extension`, `--no-session`, `--tools`, `--no-tools`, and `--resume`.
- `npm pack --dry-run`: passed, `pi-task-0.1.4.tgz`, 43 files.

Manual QA scenario note:

- `/var/folders/nj/hqfr8ndn5q56cqw7jqgbrck40000gn/T/ulw-scenarios.XXXXXX.md.WidgZz2Lwo`
- Direct TUI scoping simulation verified that a fresh/current session footer sees only that session's tasks and does not leak another session's `writer` task.
- Direct child-policy simulation verified `tools:` rules resolve to `["read","task","task_cancel","task_status"]` and in-process child creation receives `persistSession: false`.
- Read-only slop/type reviewer initially failed two issues: code-defined agent `tools` were not normalized into permissions, and direct process-runner deny-only handling used a hardcoded inherited allowlist. Both were fixed and covered by regression tests.
- GPT-5.2 xhigh verifier initially blocked five plan-completeness gaps: missing manager scoped list API, missing parent/root/model-attempt/exit facts in UI, depth-unaware task tool enabling, dropped process exit metadata, and missing live task-change UI update path. All five were fixed and covered by regression tests.
- Read-only slop/type re-review `019e3056-a318-76c1-9f79-9c913b8a7cba`: PASS after the cancellation-signal blocker was fixed.
- GPT-5.2 xhigh final verifier `019e3056-a366-7fe3-9ac6-f38d0af930d1`: PASS for plan/user-requirement conformance.

Residual notes:

- `pi` is not installed on this machine; `senpi` is installed and is the verified host command.
- Full interactive mouse QA depends on the installed pi TUI selector behavior. The extension uses `ctx.ui.select()` and `ctx.ui.confirm()` so keyboard support is covered by public API and mouse support follows the host TUI.
- `task_cancel` with an external host abort signal is covered by regression test and external re-review: the runner observes the same internal cancellation signal that TUI cancel aborts.
