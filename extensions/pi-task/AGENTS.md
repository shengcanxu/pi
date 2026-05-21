# Repository Conventions

Conventions for human contributors and AI agents working on this repository.

## Style

- Terse technical prose. No emojis in commits, issues, PR comments, or code.
- TypeScript strict mode. No `any`, no `unknown` casts where avoidable, no `@ts-ignore`, no `@ts-expect-error`, no enums.
- ESM modules with `.js` suffix in import paths.
- Tabs for indentation. Double quotes for strings.
- Tests use vitest with `#given .. #when .. #then` descriptions or plain `// given / // when / // then` body comments.

## Commands

- `npm install` — install dependencies.
- `npm test` — run vitest once.
- `npm run typecheck` — strict TypeScript check.
- `npm run check` — type check + biome.
- `npm pack --dry-run` — package smoke test.
- `pi -e ./src/index.ts` — manual local smoke test.

## Constraints

- No Bun APIs. Runtime is Node only.
- No dependency on pi-coding-agent internals outside the documented public extension API in `@mariozechner/pi-coding-agent`.
- Background task errors and final responses must remain visible through `task_status`.
- Process-mode pids and abrupt disappearance must be reported truthfully.
- Resume must preserve persisted terminal state and never pretend an unobservable process is still running.

## Don'ts

- No `git add -A` or `git add .`. Stage only the files you changed.
- No `git commit --no-verify`. No force pushes. No history rewriting on shared branches.
- Do not commit user home config or credentials.
