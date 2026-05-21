import { describe, expect, it } from "vitest";

import type { AgentInfo } from "../../src/agents/schema.js";
import { fromConfig } from "../../src/permissions/rules.js";
import { resolveAgentToolSelection } from "../../src/permissions/tool-allowlist.js";
import type { PermissionConfig } from "../../src/runtime/types.js";

function createAgent(overrides: Partial<AgentInfo> & { tools?: PermissionConfig }): AgentInfo {
	const tools = overrides.tools;
	return {
		name: "finder",
		mode: "all",
		permission: fromConfig(tools ?? {}),
		allowedSubagents: [],
		disallowedTools: [],
		disable: false,
		prompt: "Find facts.",
		native: false,
		...overrides,
		...(tools !== undefined && { tools, permission: fromConfig(tools) }),
	};
}

describe("agent tool selection", () => {
	it("#given explicit allow rules #when resolving child tools #then returns a stable pi tool allowlist", () => {
		const agent = createAgent({
			tools: {
				read: "allow",
				bash: "allow",
				edit: "deny",
			},
		});

		const selection = resolveAgentToolSelection(agent);

		expect(selection).toEqual({ kind: "allowlist", tools: ["bash", "read"] });
	});

	it("#given tools config without normalized permission #when resolving child tools #then still applies tools rules", () => {
		const agent = createAgent({
			tools: {
				read: "allow",
			},
			permission: [],
		});

		const selection = resolveAgentToolSelection(agent);

		expect(selection).toEqual({ kind: "allowlist", tools: ["read"] });
	});

	it("#given task-specific permissions #when resolving child tools #then enables task companion tools", () => {
		const agent = createAgent({
			tools: {
				task: {
					"web-librarian": "allow",
				},
			},
		});

		const selection = resolveAgentToolSelection(agent);

		expect(selection).toEqual({ kind: "allowlist", tools: ["task", "task_cancel", "task_status"] });
	});

	it("#given max depth already reached #when resolving child tools #then does not enable task by depth alone", () => {
		const agent = createAgent({ maxDepth: 1 });

		const selection = resolveAgentToolSelection(agent, 1);

		expect(selection).toEqual({ kind: "inherit", disallowedTools: [] });
	});

	it("#given max depth allows deeper nesting #when resolving child tools #then enables task by depth", () => {
		const agent = createAgent({ maxDepth: 2 });

		const selection = resolveAgentToolSelection(agent, 1);

		expect(selection).toEqual({ kind: "allowlist", tools: ["task", "task_cancel", "task_status"] });
	});

	it("#given allowed subagents #when resolving child tools #then enables task even without a tools rule", () => {
		const agent = createAgent({ allowedSubagents: ["writer"] });

		const selection = resolveAgentToolSelection(agent);

		expect(selection).toEqual({ kind: "allowlist", tools: ["task", "task_cancel", "task_status"] });
	});

	it("#given only disallowed tools #when resolving child tools #then preserves inherited tools with a deny list", () => {
		const agent = createAgent({ disallowedTools: ["edit", "write"] });

		const selection = resolveAgentToolSelection(agent);

		expect(selection).toEqual({ kind: "inherit", disallowedTools: ["edit", "write"] });
	});
});
