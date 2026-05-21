# Changelog

## 0.1.4

- Scope footer/widget task visibility to the current parent/root session so fresh sessions do not show stale persisted tasks.
- Show active task identity in TUI status rows: task id, agent, model, mode, pid, child id, progress, error, final response, and resume state.
- Propagate agent frontmatter tool policy into child execution with in-process `tools` and process-mode `--tools` / `--no-tools`.
- Run in-process subagents in isolated in-memory sessions so task children do not appear in `/resume`.
- Preserve `cancelled` when cancellation races with runner failure, avoiding parent-session crashes.
- Expand `task` and `task_status` structured details with agent/model/mode/session/final/error metadata.

## 0.1.3

- Remove extension API type assertions flagged by the TypeScript no-excuse gate.
- Replace nondeterministic async sleeps in tests with deterministic synchronization.
- Add behavioral cancellation coverage and record GPT-5.2 xhigh no-slop verification.

## 0.1.2

- Stream process-mode pid and heartbeat updates while tasks are still running.
- Parse full YAML frontmatter so nested `tools:` permission policies are honored.
- Record independent verifier status in QA documentation.

## 0.1.1

- Enforce nested task depth, allowed subagent overrides, and frontmatter task permissions.
- Add code-defined agent registration helpers.

## 0.1.0

- Initial task subagent extension package.
