# Manual QA Evidence

Date: 2026-05-17

Scenario note path:

```text
/var/folders/nj/hqfr8ndn5q56cqw7jqgbrck40000gn/T/ulw-scenarios.XXXXXX.md.WidgZz2Lwo
```

Verified manually:

- `npm run qa:import` loads the extension default export.
- `npm run qa:status-scope` proves footer/widget formatting is scoped to the current session and does not leak tasks from another parent/root.
- `npm run qa:child-tools` proves frontmatter tool rules resolve into child active tools and in-process children are created with `persistSession: false`.
- Child agents are isolated by default and do not fork parent chat history; in-process uses an in-memory session and process mode uses `--no-session`.
- `npm run qa:process-kill` records pid and reports `killed` after direct external `SIGTERM`.
- `npm run qa:senpi-install` resolves the local install symlink target.
- `npm test` now covers 21 files / 65 tests, including nested task policy, depth-aware tool allowlists, session-scoped status UI, non-persistent child sessions, process exit metadata, live task-change notifications, cancel/failure races, and cancellation signal propagation from `task_cancel` to the active runner.
- `senpi --help` confirms `senpi install <source>` and `--extension/-e` host support.
- `command -v pi` returned no binary on this machine, so local host checks use `senpi`.
- External read-only reviewers returned PASS for no-slop/type quality and GPT-5.2 xhigh plan conformance after the final cancellation-signal fix.

Automated gates are summarized in `docs/qa-results.md`.
