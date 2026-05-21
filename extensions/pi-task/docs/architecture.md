# Architecture

Status: IMPLEMENTED

`pi-task` uses the public pi SDK and extension APIs. The extension owns task lifecycle state, result persistence, process supervision, and UI projection.

Core rule: background task errors, abrupt process exits, resume state, and final responses must remain visible through `task_status`.

## Components

- `agents`: markdown agent registry with pi/senpi-compatible search paths.
- `permissions`: senpi-compatible last-match-wins rule evaluation for task policy.
- `runtime`: task state, result store, runners, resume reconciliation, and model fallback.
- `tools`: `task`, `task_status`, `task_cancel`.
- `ui`: compact status and widget rendering.

## Runtime Modes

In-process mode is the default. `InProcessRunner` creates a child `AgentSession` with `createAgentSession()`, records the child session id, injects the selected subagent prompt into the task prompt, and returns the last assistant text as the final response.

The child session manager is in-memory. This is intentional: task children are separate isolated contexts for work delegation, not normal user sessions. They do not fork parent chat history and do not create session files that appear in `/resume`.

Process mode uses `ProcessTaskRunner` and `ProcessRunner`. It launches a separate `senpi`/current-runtime process in JSON print mode with `--no-session`, includes task id, parent/root session ids, and subagent type in the prompt, records the child pid, parses the final assistant response from JSON lines, and reports `killed` when the process exits by signal.

`CompositeTaskRunner` routes by `task.executionMode`, so both modes share persistence, logging, cancellation, status UI, and fallback handling.

## Agent Definition And Task Policy

Markdown agents are loaded from project and user `.pi` / `.senpi` locations, including `~/.senpi/agents/agents`. Code can also define agents by importing `defineAgent()` or `registerAgent()` from `pi-task`.

Nested tasks are enforced before a task record is created:

- Top-level parent sessions may create depth-1 tasks.
- Default `maxDepth` is `1`.
- A parent agent's `allowedSubagents` permits the named target even beyond depth.
- Frontmatter task permissions can allow or deny `task:<agent>` or `task` patterns.
- Denied delegations return a `denied` status and do not start a runner.

Child tool scope is resolved from the same agent metadata:

- Explicit `tools:` allow rules become a pi active-tool allowlist for the child.
- `task` and `task:<agent>` allow rules enable the task tool family: `task`, `task_status`, and `task_cancel`.
- `allowedSubagents` also enables the task tool family because it is an explicit policy override for nested delegation.
- `disallowedTools` are removed from inherited or explicit tool sets.
- In-process mode passes the allowlist through `createAgentSession({ tools })`; process mode passes `--tools` or `--no-tools`.

## Persistence And Resume

Task records are atomically written to `~/.senpi/task/tasks/<task-id>.json`. Final responses and errors remain available through `task_status` after the task finishes.

On `session_start`, `TaskManager.resume()` reloads persisted task records. Completed terminal tasks are restored as resumed. Running process tasks are reconciled by pid and heartbeat state; missing pids, dead pids, or stale heartbeats become `lost` with an explanation. Running in-process tasks from a previous process also become `lost` because their memory-local child loop cannot be reattached.

Cancellation is terminal and idempotent. If a runner later fails after the parent has already cancelled the task, the manager preserves `cancelled` and logs the late failure instead of attempting an invalid `cancelled -> failed` transition.

Task JSONL logs are written to `~/.senpi/task/logs/<task-id>.jsonl`; token/password/secret/authorization/api-key-like fields are redacted.

## Pi Event Mapping

`pi-task` centralizes event registrations in an event bridge:

- `session_start`: reload persisted task records, reconcile process-mode tasks, restore status UI, and append a compact `pi-task.event`.
- `session_shutdown`: append shutdown state and refresh UI.
- `agent_start` / `agent_end`: append parent lifecycle markers.
- `tool_call` / `tool_result`: append tool lifecycle markers without treating event order as authoritative state.
- `model_select`: refresh inherited parent model context.
- `before_agent_start`: inject concise task guidance once.

Detailed logs are file-backed JSONL records. Compact summaries use `pi.appendEntry()` so resume can reconstruct parent-visible task history.

## Public API Boundary

Runtime code must use `@mariozechner/pi-coding-agent` public exports only. If a public SDK capability is insufficient for native child sessions, `pi-task` reports an explicit unsupported state instead of importing private internals.

## Limitations

## TUI Surface

`syncTaskStatusToUi()` renders a current-session footer status (`tasks:N run:N done:N err:N | <active-task>`) and a below-editor widget for active tasks. The active row includes task id, agent, state, execution mode, model, pid, child id, resume state, latest progress, final summary, or error summary when present.

The footer/widget are scoped by `ctx.sessionManager.getSessionId()`. A fresh top-level session does not display stale tasks from other roots. Explicit surfaces still work: `/tasks` shows the current session list, `/tasks --all` includes persisted tasks from other sessions, and `task_status(task_id)` can inspect a known persisted task by id regardless of UI scope.

`/task-kill` opens pi's selector/confirmation UI for cancellable tasks in the current session; that inherits pi TUI keyboard handling and mouse handling where the installed TUI exposes it. `task_cancel` provides model/tool-call cancellation in all modes.
