import { describe, expect, it } from "vitest";

import type { AgentInfo } from "../../src/agents/schema.js";
import { fromConfig } from "../../src/permissions/rules.js";
import { decideTaskPolicy } from "../../src/runtime/task-policy.js";

function parentAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
	return {
		name: "finder",
		mode: "all",
		permission: [],
		allowedSubagents: [],
		disallowedTools: [],
		disable: false,
		prompt: "Find.",
		native: false,
		...overrides,
	};
}

describe("task policy", () => {
	it("#given top-level task #when checking default depth #then allows first child", () => {
		expect(decideTaskPolicy({ targetAgentType: "finder" }).allowed).toBe(true);
	});

	it("#given nested task past default depth #when not allowlisted #then denies", () => {
		const decision = decideTaskPolicy({
			targetAgentType: "writer",
			ancestry: {
				taskId: "task_parent",
				agentType: "finder",
				parentSessionId: "parent",
				rootSessionId: "root",
				depth: 1,
			},
			parentAgent: parentAgent(),
		});

		expect(decision.allowed).toBe(false);
		expect(decision.reason).toContain("exceeds maxDepth");
	});

	it("#given nested task past depth #when parent allowedSubagents contains target #then allows", () => {
		const decision = decideTaskPolicy({
			targetAgentType: "web-librarian",
			ancestry: {
				taskId: "task_parent",
				agentType: "finder",
				parentSessionId: "parent",
				rootSessionId: "root",
				depth: 1,
			},
			parentAgent: parentAgent({ allowedSubagents: ["web-librarian"] }),
		});

		expect(decision).toEqual({ allowed: true, reason: "allowed-subagent" });
	});

	it("#given permission deny #when target matches #then denies", () => {
		const decision = decideTaskPolicy({
			targetAgentType: "writer",
			parentAgent: parentAgent({ permission: fromConfig({ "task:writer": "deny" }) }),
		});

		expect(decision.allowed).toBe(false);
	});
});
