# pi-task

Task subagent extension for the pi coding agent.

`pi-task` registers `task`, `task_status`, and `task_cancel` so parent agents can start foreground or background subagents, inspect final responses, see internal errors, cancel work, and reconcile process-mode tasks after resume.

## Features

- Default in-process child agent sessions through the public pi SDK.
- Optional separate process mode with pid reporting and external-kill detection.
- Background task state, final responses, and errors retrievable with `task_status`.
- Current-session TUI footer/widget rows with task id, agent, model, mode, pid, progress, and terminal facts.
- Session resume reconciliation through `~/.senpi/task/tasks/*.json`.
- JSONL task logs under `~/.senpi/task/logs/*.jsonl` with secret-like fields redacted.
- Agent frontmatter loading from `.pi`, `.senpi`, `~/.pi/agent`, `~/.senpi/agent`, and `~/.senpi/agents`.
- Code-defined agents through `defineAgent()` and `registerAgent()`.
- Nested task policy with default max depth `1`; `allowedSubagents` and task permissions can explicitly allow deeper calls.
- Agent tool policy propagation into children through in-process active tools and process-mode `--tools`.
- Model fallback for `models: [provider/a, provider/b]`.
- TUI footer/widget status plus scoped `/tasks`, explicit `/tasks --all`, `/task-kill`, and a keyboard shortcut.

See [docs/spec.md](docs/spec.md), [docs/architecture.md](docs/architecture.md), and [docs/qa-results.md](docs/qa-results.md).

## Agent Example

```md
---
description: Find facts with read-only tools
background: true
executionMode: in-process
models:
  - openai/gpt-5.5-fast
  - anthropic/claude-opus-4-7
allowedSubagents:
  - github-librarian
  - web-librarian
maxDepth: 1
tools:
  read: allow
  task:
    "web-librarian": allow
  bash:
    "rg *": allow
---
You are a careful finder. Return concise evidence with file paths.
```

Place agents in paths such as `~/.senpi/agents/agents/finder.md` or project `.senpi/agents/finder.md`.

## Runtime Notes

- In-process subagents use an isolated in-memory pi session. They inherit the parent model unless an agent `model` or `models` fallback list is configured, but they do not fork parent chat history and do not create `/resume` entries.
- Process subagents run with `--no-session`, so child transcripts are not resumable as normal sessions. Task-level state is still persisted under `~/.senpi/task/tasks`.
- The footer/widget only shows tasks for the current parent/root session. `task_status(task_id: "...")` remains explicit and can inspect persisted tasks by id.
- `tools:` frontmatter uses the same last-match-wins rule shape as senpi permission config. Explicit `allow` entries become the child allowlist; `disallowedTools` are removed. `task` / `task:<agent>` permissions enable `task`, `task_status`, and `task_cancel` for permitted nested delegation.

## Development

```bash
npm install
npm test
npm run typecheck
npm run check
npm run qa:status-scope
npm run qa:child-tools
npm pack --dry-run
senpi -e ./src/index.ts
```

## Local Install

```bash
node scripts/qa-senpi-install.mjs --force
```

This installs a local symlink at `~/.senpi/agent/extensions/pi-task`.

## License

[MIT](LICENSE).
