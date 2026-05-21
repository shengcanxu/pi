# Planning Summary

Status: IMPLEMENTED

The implementation followed the external planner output recorded at `../plans/pi-task.md` and folded the durable plan into this repository through:

- [spec.md](spec.md): user request AS-IS, product-critical emphasis, resume/process-loss/event/logging requirements.
- [architecture.md](architecture.md): component boundaries, mode routing, persistence, resume, event mapping, and TUI surface.
- [qa-plan.md](qa-plan.md): automated and manual QA plan.
- [qa-results.md](qa-results.md): command-backed QA outcomes.

Exploration inputs:

- Existing pi extension practices in neighboring `pi-*` packages.
- `../pi-mono` public SDK/extension API surface.
- `../opencode` parent/child session and task concepts.
- `../omo` real-time status/activity monitor patterns.
- `../free-code` default model inheritance, background task display, and subagent schema ideas.
- `../senpi` settings, permissions, and local extension install conventions.

Primary implementation choices:

- In-process is the default runner.
- Process mode is explicit through agent frontmatter or tool params.
- Nested task depth is enforced before starting a task; `allowedSubagents` overrides the default max depth.
- Agents can be markdown-loaded or code-registered.
- Background state is first-class and retrievable by `task_status`.
- Final responses and errors are persisted before the manager reports completion.
- Abrupt process termination is represented as `killed`; unobservable resumed process tasks become `lost`.
- Model fallback is task-local, updating `modelAttempts` inside one task record.
