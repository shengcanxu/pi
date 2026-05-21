import { describe, expect, it } from "vitest";

import { InProcessRunner } from "../../src/runtime/in-process-runner.js";
import { createTaskRecord } from "../../src/runtime/task-state.js";

describe("in-process runner", () => {
	it("#given agent prompt #when task runs #then starts child session and returns final assistant text", async () => {
		let promptSeen = "";
		let createSessionInput: { persistSession?: boolean } | undefined;
		const runner = new InProcessRunner({
			loadAgents: async () => ({
				finder: {
					name: "finder",
					mode: "all",
					permission: [],
					allowedSubagents: [],
					disallowedTools: [],
					disable: false,
					prompt: "Find facts carefully.",
					native: false,
				},
			}),
			createSession: async (input) => {
				createSessionInput = input;
				return {
					sessionId: "child-session",
					state: {
						messages: [
							{
								role: "assistant",
								content: [{ type: "text", text: "Child final" }],
							},
						],
					},
					subscribe: () => () => {},
					prompt: async (prompt) => {
						promptSeen = prompt;
					},
					dispose: () => {},
				};
			},
		});
		const task = createTaskRecord({
			taskId: "task_1",
			agentType: "finder",
			prompt: "Inspect api",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "in-process",
		});

		const result = await runner.run({ task });

		expect(promptSeen).toContain("Find facts carefully.");
		expect(promptSeen).toContain("Inspect api");
		expect(result.childSessionId).toBe("child-session");
		expect(result.status).toBe("completed");
		expect(result.finalResponse).toBe("Child final");
		expect(createSessionInput?.persistSession).toBe(false);
	});

	it("#given task tool allowlist #when task runs #then passes tools into child session", async () => {
		let createSessionInput: { tools?: string[]; persistSession?: boolean } | undefined;
		const runner = new InProcessRunner({
			loadAgents: async () => ({}),
			createSession: async (input) => {
				createSessionInput = input;
				return {
					sessionId: "child-session",
					state: { messages: [] },
					subscribe: () => () => {},
					prompt: async () => {},
					dispose: () => {},
				};
			},
		});
		const task = createTaskRecord({
			taskId: "task_2",
			agentType: "finder",
			prompt: "Inspect api",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "in-process",
			toolAllowlist: ["read", "task"],
		});

		await runner.run({ task });

		expect(createSessionInput?.tools).toEqual(["read", "task"]);
		expect(createSessionInput?.persistSession).toBe(false);
	});

	it("#given inherited tools with disallowed entries #when task runs #then removes them from active child tools", async () => {
		let activeTools: string[] = ["read", "bash", "edit", "write"];
		const runner = new InProcessRunner({
			loadAgents: async () => ({}),
			createSession: async () => ({
				sessionId: "child-session",
				state: { messages: [] },
				subscribe: () => () => {},
				getActiveToolNames: () => activeTools,
				setActiveToolsByName: (nextTools) => {
					activeTools = nextTools;
				},
				prompt: async () => {},
				dispose: () => {},
			}),
		});
		const task = createTaskRecord({
			taskId: "task_3",
			agentType: "finder",
			prompt: "Inspect api",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "in-process",
			toolDisallowlist: ["edit", "write"],
		});

		await runner.run({ task });

		expect(activeTools).toEqual(["read", "bash"]);
	});
});
