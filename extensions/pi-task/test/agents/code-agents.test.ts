import { afterEach, describe, expect, it } from "vitest";

import { clearRegisteredAgents, defineAgent, registerAgent } from "../../src/agents/code-agents.js";
import { loadAllAgents } from "../../src/agents/loader.js";

afterEach(() => {
	clearRegisteredAgents();
});

describe("code-defined agents", () => {
	it("#given registered code agent #when loading agents #then it is available like markdown agents", async () => {
		registerAgent({
			name: "code-finder",
			prompt: "Find from code.",
			background: true,
			models: ["provider/a", "provider/b"],
		});

		const agents = await loadAllAgents(process.cwd(), "/tmp/pi-task-no-home");

		expect(agents["code-finder"]?.prompt).toBe("Find from code.");
		expect(agents["code-finder"]?.native).toBe(true);
		expect(agents["code-finder"]?.models).toEqual(["provider/a", "provider/b"]);
	});

	it("#given code agent tools #when defining agent #then converts tools into permission rules", () => {
		const agent = defineAgent({
			name: "code-finder",
			prompt: "Find from code.",
			tools: {
				read: "allow",
				task: {
					writer: "allow",
				},
			},
		});

		expect(agent.permission).toEqual(
			expect.arrayContaining([
				{ permission: "read", pattern: "*", action: "allow" },
				{ permission: "task", pattern: "writer", action: "allow" },
			]),
		);
	});
});
