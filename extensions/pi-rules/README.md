# pi-rules

[![ci](https://github.com/code-yeongyu/pi-rules/actions/workflows/ci.yml/badge.svg)](https://github.com/code-yeongyu/pi-rules/actions/workflows/ci.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![npm](https://img.shields.io/badge/npm-%40code--yeongyu%2Fpi--rules-red)](https://www.npmjs.com/package/@code-yeongyu/pi-rules)

Rule context loader for the [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). Discovers rule files from `.omo/rules/`, `.claude/rules/`, `.cursor/rules/`, `.github/instructions/`, `AGENTS.md`, `CLAUDE.md`, and injects them into the agent context.

## Origin

pi-rules is inspired by [oh-my-openagent (omo)](https://github.com/code-yeongyu/oh-my-openagent) `.omo/rules/` and opencode's `AGENTS.md` / `CLAUDE.md` instruction file mechanisms.

- [omo](https://github.com/code-yeongyu/oh-my-openagent) at https://github.com/code-yeongyu/oh-my-openagent is by Yeongyu Kim, originally SUL-1.0.
- This package is an **independent** pi-coding-agent extension by the same author.
- Source distributed here is MIT (see [LICENSE](LICENSE) and [NOTICE](NOTICE)).
- The logic is structurally similar to omo's rules-injector hook, adapted to pi-mono's ExtensionAPI hooks (`before_agent_start`, `tool_result`).

## Quick Demo

```text
$ pi -e ./src/index.ts

[pi-rules] 5 active rules

> Read src/auth/login.ts

  ✓ src/auth/login.ts (1.2KB)

[pi-rules] +2 instructions injected (security.md, typescript.md)
```

## Installation

The package targets the [`pi`](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) coding agent. Pi loads extensions from `~/.pi/agent/extensions/`, project `.pi/extensions/`, or via the `--extension` / `-e` CLI flag.

Pick whichever route fits:

```bash
# 1. From npm (once published)
pi install npm:@code-yeongyu/pi-rules

# 2. From git (once the repository is pushed)
pi install git:github.com/code-yeongyu/pi-rules

# 3. Manual placement (always works)
git clone https://github.com/code-yeongyu/pi-rules ~/.pi/agent/extensions/pi-rules
cd ~/.pi/agent/extensions/pi-rules && npm install

# 4. Dev / one-shot test
pi -e /path/to/pi-rules/src/index.ts
```

After installation, restart pi (or run `/reload` inside an interactive session).

## What gets loaded

### Project rule directories (recursive `*.md` / `*.mdc`)

| Directory | Style |
|-----------|-------|
| `.omo/rules/` | omo style |
| `.claude/rules/` | Claude Code style |
| `.cursor/rules/` | Cursor style |
| `.github/instructions/` | GitHub Copilot style (only `*.instructions.md`) |

These use **walk-up stack semantics**: from the target file's directory up to the project root, rules at every level are collected. Closer directories win in precedence.

### Project single-file rules

| File | Style |
|------|-------|
| `.github/copilot-instructions.md` | GitHub Copilot |
| `AGENTS.md` | opencode style |
| `CLAUDE.md` | Claude Code style |
| `CONTEXT.md` | deprecated, still supported |

These use **first-match-wins** at the project root: `AGENTS.md` takes priority over `CLAUDE.md`, which takes priority over `CONTEXT.md`.

### User-home rules (always-on, distance 9999)

| Path | Type |
|------|------|
| `~/.omo/rules/` | directory |
| `~/.opencode/rules/` | directory |
| `~/.claude/rules/` | directory |
| `~/.config/opencode/AGENTS.md` | single-file |
| `~/.claude/CLAUDE.md` | single-file |

User-home rules are global and apply to every project with the lowest precedence.

## Rule format

Rules are Markdown files with an optional YAML frontmatter block:

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Optional short description |
| `globs` | `string \| string[]` | Glob patterns; rule applies if target file matches any |
| `paths` | `string \| string[]` | Claude Code alias for globs (merged) |
| `applyTo` | `string \| string[]` | GitHub Copilot alias for globs (merged) |
| `alwaysApply` | `boolean` | If true, rule always applies regardless of target |

Example rule file:

```markdown
---
description: TypeScript-specific rules
globs: ["**/*.ts", "**/*.tsx"]
---

# TypeScript

Prefer `unknown` over `any`. Use exhaustive switch checks.
```

## Precedence and merging

Rules are ordered deterministically before injection:

1. **Local before global** — project rules outrank user-home rules.
2. **Closest distance first** — rules from directories nearer to the target file take priority.
3. **Source priority** — `.omo/rules` > `.claude/rules` > `.cursor/rules` > `.github/instructions` > `AGENTS.md` > `CLAUDE.md` > `CONTEXT.md` > user-home variants.
4. **Lexicographic `relativePath`** — final tiebreaker for same-source, same-distance rules.

Deduplication is in-memory per session by `realPath + content hash`. No filesystem persistence.

## Slash commands

| Command | Purpose |
|---------|---------|
| `/rules` | Summary of active rules |
| `/rules list` | List all rule files with paths |
| `/rules show <id>` | Show body of one rule |
| `/rules paths` | List absolute paths only |
| `/rules status` | Counts and warnings |
| `/reload-rules` | Rescan and clear injection cache |

All commands work in both UI and plain-text modes.

## TUI widget

On session start, a banner appears above the editor with a `[pi-rules]` prefix and a list of top rules. Active rules show a `●` indicator; rules with warnings show `⚠`. The banner dismisses on the first `before_agent_start` event.

A persistent status line reads `[pi-rules] N active` and updates as rules are discovered or rescanned.

## Configuration

### CLI flags

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `pi-rules-disabled` | `boolean` | `false` | Disable all injection |
| `pi-rules-mode` | `string` | `both` | `static` \| `dynamic` \| `both` \| `off` |
| `pi-rules-widget` | `boolean` | `true` | Show banner and status line |

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PI_RULES_DISABLED` | unset | If `1`, disables injection |
| `PI_RULES_MAX_RULE_CHARS` | `12000` | Per-rule body cap |
| `PI_RULES_MAX_RESULT_CHARS` | `40000` | Total injected per tool result |

## Trust model

Rule files are prompt and context input. Do NOT load untrusted repositories. All rule loading is local filesystem reads. There is no network or remote rule fetching.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No rules loaded | Verify `.omo/rules/`, `AGENTS.md`, etc. exist in the project root or ancestors. Run `/rules` to inspect. |
| Rule not matching | Check frontmatter `globs` / `paths` / `applyTo`. Confirm the target file path matches the glob. |
| Duplicate injection | Automatically deduplicated per session. Try `/reload-rules` to reset. |
| Extension not loaded | Confirm `pi.extensions` in your `package.json` or use `pi -e ./src/index.ts` for one-shot. |
| Context too large | Adjust `PI_RULES_MAX_RULE_CHARS` and `PI_RULES_MAX_RESULT_CHARS`. |
| TUI widget missing | Check `pi-rules-widget` flag is true and your terminal supports the relevant glyphs. |

## Development

```bash
git clone https://github.com/code-yeongyu/pi-rules
cd pi-rules
npm install            # install dev + peer deps
npm test               # 229 unit tests
npm run test:integration  # 43 integration tests
npm run typecheck      # tsc --noEmit
npm run check          # tsc + biome
pi -e ./src/index.ts   # smoke-test inside a real pi session
```

The test suite uses Vitest. Test descriptions follow `#given X #when Y #then Z` style; bodies use `// given / // when / // then` plain comments. No `any` in production code, no enums.

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for re-license disclosure relative to omo.

## Related

- [senpi](https://github.com/code-yeongyu/senpi) — the fork/runtime these extensions are extracted from.
- [Ultraworkers Discord](https://discord.gg/PUwSMR9XNk) — community link from the senpi README.
- [Dori](https://sisyphuslabs.ai) — the product powered by senpi under the hood.

## Acknowledgements

- **Yeongyu Kim** ([@code-yeongyu](https://github.com/code-yeongyu)) — author of [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (origin of the rules-injection idea), and of this pi port.
- **Mario Zechner** ([@badlogic](https://github.com/badlogic)) — author of [pi-mono](https://github.com/badlogic/pi-mono) and the pi-coding-agent extension API this package targets.
- **opencode** — for the elegant `Instructions from: <path>` formatting convention adopted here.



## 通俗理解
实际上是 AI 辅助编程工具（如 Cursor, GitHub Copilot, Claude Code, Cline 等）的 .cursorrules / .github/copilot-instructions 机制。
之前我解释的是通用 Agent 框架中的“规则”概念，而你发的这个是专门针对“代码生成/AI编程助手”的 Rule format。
这种格式的 Rules 极其强大，它的核心作用是：让 AI 根据你当前正在编辑的文件类型或项目目录，自动切换上下文和编码规范。
下面我用最通俗的语言拆解它到底有什么用，以及各个字段的威力。

一、 核心痛点：为什么需要 globs 这种设计？
如果没有这个机制，你只能在项目根目录写一个全局的 System Prompt（比如“请写干净的代码”）。但这会有问题：
当你写 Python 后端时，你希望 AI 遵守 PEP8，用 Duck Typing。
当你写 React/TypeScript 前端时，你希望 AI 遵守函数式组件、Hooks 规范，不能用 any。
当你写 SQL 时，你希望 AI 遵守特定的表命名规范。
全局规则无法做到**“看人下菜碟”**。而这套 Rule Format 通过 globs (文件匹配模式) 完美解决了这个问题：AI 会在你打开特定文件时，自动加载对应的规则。

二、 字段逐一拆解与使用场景
结合你给的例子：
---
description: TypeScript-specific rules
globs: ["**/*.ts", "**/*.tsx"]
---
# TypeScript
Prefer `unknown` over `any`. Use exhaustive switch checks.
1. globs / paths / applyTo (核心触发器)
这三个字段作用一样（只是为了兼容不同的 AI 工具叫法不同），用来定义规则生效的文件范围。
作用：当你打开一个匹配的文件时，AI 才会读取并应用下面的 Markdown 规则。
例子中的效果：只有当你在编辑器里打开 .ts 或 .tsx 文件时，AI 才会对自己说“哦，现在写 TS 了，不能用 any，要用 unknown”。如果你打开一个 .py 文件，这条规则就不会生效，AI 也就不会把 Python 的逻辑和 TS 的规范搞混。
2. alwaysApply (全局强规则)
布尔值，默认 false。如果设为 true，则无视 globs，无论你打开什么文件，规则都生效。
使用场景：项目级别的通用规范。
例子：---
description: Global project rules
alwaysApply: true
---
## 通用规范
- 所有提交的注释必须使用英文。
- 禁止使用 var，统一使用 const 或 let。
- 任何 API 调用必须有 Error Handling。

3. description (给人类和 AI 看的索引)
简短描述这条规则是干嘛的。AI 在后台筛选规则时，有时会先看 description 来判断相关度；对开发者来说，也方便管理一堆规则文件。

4. Markdown 正文 (真正的规则)
YAML 头下面的部分就是具体的指令，支持 Markdown 格式，写得越结构化越好。

三、 实战演练：如何用这套机制大幅提升 AI 写代码的质量？
假设你有一个全栈项目，你可以建立一个 .cursor/rules 或类似目录，放好几个规则文件：
文件 1：python-backend.mdc
---
description: Python FastAPI backend rules
globs: ["server/**/*.py"]
---
# Python 规范
- 使用 Python 3.10+ 语法（用 match-case 而不是 if-elif）。
- 必须使用 Type Hints，所有函数参数和返回值都要有类型。
- 异步操作必须使用 `async/await`，不要用同步阻塞库。
- 数据库 Session 必须通过 Depends 注入。
文件 2：react-frontend.mdc
---
description: React frontend rules
globs: ["src/**/*.tsx", "src/**/*.ts"]
---
# React 规范
- 必须使用函数式组件，禁止使用 Class 组件。
- 状态逻辑必须抽取到 `zustand`，不要用 Context。
- **绝对禁止使用 `any`，必须用 `unknown` 并做类型守卫**。
- 组件导出使用 `export default function ComponentName` 的形式。
文件 3：sql-rules.mdc
---
description: Database SQL rules
globs: ["**/*.sql", "**/migrations/**"]
---
# 数据库规范
- 表名和字段名一律使用 `snake_case`。
- 每张表必须有 `created_at` 和 `updated_at` 字段。
- 禁止使用 `DELETE` 语句，必须使用软删除（`is_deleted` 字段）。

总结
这套 Rule Format 的本质是“条件触发式的系统提示词”。
它的巨大作用在于：让你可以为项目的每一个技术栈、每一个目录定制专属的 AI 行为。它避免了全局规则臃肿不堪、AI 抓错重点的问题，让 AI 在写前端时像个前端专家，写后端时像个后端专家，极大降低 AI 产生“幻觉”和乱写代码的概率。