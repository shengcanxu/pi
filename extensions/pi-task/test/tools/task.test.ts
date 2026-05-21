import { afterEach, describe, expect, it } from "vitest";
import { clearInProcessAncestry, registerInProcessAncestry } from "../../src/runtime/ancestry.js";
import type { RunnerResult } from "../../src/runtime/task-manager.js";
import { TaskManager } from "../../src/runtime/task-manager.js";
import { createTaskTool } from "../../src/tools/task.js";
import { createTaskCancelTool } from "../../src/tools/task-cancel.js";
import { createTaskStatusTool } from "../../src/tools/task-status.js";
import { deferred } from "../helpers/deferred.js";

type ToolTestContext = {
	cwd: string;
	sessionManager: { getSessionId: () => string };
};

function createExtensionContext(): ToolTestContext {
	return {
		cwd: process.cwd(),
		sessionManager: { getSessionId: () => "parent" },
	};
}

afterEach(() => {
	clearInProcessAncestry("parent");
});

describe("task tool", () => {
	it("#given foreground task #when executed #then returns final response and persists status", async () => {
		const manager = new TaskManager({
			runner: {
				async run() {
					return { status: "completed", finalResponse: "Final answer", progress: ["working"] };
				},
			},
		});
		const task = createTaskTool(manager);

		const result = await task.execute(
			"call_1",
			{ prompt: "Do work", subagent_type: "finder", background: false },
			undefined,
			undefined,
			createExtensionContext(),
		);

		expect(result.content[0]?.type).toBe("text");
		expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("Final answer");
		expect(manager.get(result.details.task_id)?.status).toBe("completed");
	});

	it("#given background task #when executed #then returns task id immediately and status can be polled", async () => {
		const backgroundResult = deferred<RunnerResult>();
		const manager = new TaskManager({
			runner: {
				async run() {
					return await backgroundResult.promise;
				},
			},
		});
		const task = createTaskTool(manager);
		const status = createTaskStatusTool(manager);

		const result = await task.execute(
			"call_2",
			{ prompt: "Do work", subagent_type: "finder", background: true },
			undefined,
			undefined,
			createExtensionContext(),
		);

		expect(result.details.task_id).toMatch(/^task_/);
		backgroundResult.resolve({ status: "completed", finalResponse: "Background final", progress: ["done"] });
		const statusResult = await status.execute("call_3", {
			task_id: result.details.task_id,
			wait: true,
			timeout_ms: 200,
		});

		expect(statusResult.content[0]?.type === "text" ? statusResult.content[0].text : "").toContain(
			"Background final",
		);
		expect(statusResult.details).toMatchObject({
			task_id: result.details.task_id,
			status: "completed",
			final_response: "Background final",
			execution_mode: "in-process",
			agent_type: "finder",
			model_attempts: [{ model: "inherit", status: "completed" }],
		});
	});

	it("#given default agent config #when fields are omitted #then applies frontmatter defaults", async () => {
		const backgroundResult = deferred<RunnerResult>();
		const manager = new TaskManager({
			runner: {
				async run() {
					return await backgroundResult.promise;
				},
			},
		});
		const task = createTaskTool(manager, {
			loadAgents: async () => ({
				default: {
					name: "default",
					mode: "all",
					models: ["provider/a", "provider/b"],
					permission: [],
					background: true,
					executionMode: "process",
					allowedSubagents: [],
					disallowedTools: [],
					disable: false,
					prompt: "Default task agent",
					native: false,
				},
			}),
		});

		const result = await task.execute(
			"call_4",
			{ prompt: "Do work" },
			undefined,
			undefined,
			createExtensionContext(),
		);
		const stored = manager.get(result.details.task_id);

		expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("Started background task");
		expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("agent:default");
		expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("mode:process");
		expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("model:provider/a");
		expect(result.details).toMatchObject({
			task_id: result.details.task_id,
			status: "running",
			agent_type: "default",
			execution_mode: "process",
			model: "provider/a",
		});
		expect(stored?.executionMode).toBe("process");
		expect(stored?.model).toBe("provider/a");
		expect(stored?.modelAttempts.map((attempt) => attempt.model)).toEqual(["provider/a", "provider/b"]);
		backgroundResult.resolve({ status: "completed", finalResponse: "done" });
		await manager.wait(result.details.task_id, 100);
	});

	it("#given agent tool permissions #when task starts #then stores child tool policy for runners and status", async () => {
		const backgroundResult = deferred<RunnerResult>();
		const manager = new TaskManager({
			runner: {
				async run() {
					return await backgroundResult.promise;
				},
			},
		});
		const task = createTaskTool(manager, {
			getActiveTools: () => ["read", "edit", "task", "custom_tool"],
			loadAgents: async () => ({
				finder: {
					name: "finder",
					mode: "subagent",
					tools: { read: "allow", task: { writer: "allow" }, edit: "deny" },
					permission: [
						{ permission: "read", pattern: "*", action: "allow" },
						{ permission: "task", pattern: "writer", action: "allow" },
						{ permission: "edit", pattern: "*", action: "deny" },
					],
					allowedSubagents: [],
					disallowedTools: ["write"],
					disable: false,
					prompt: "Find",
					native: false,
				},
			}),
		});

		const result = await task.execute(
			"call_tools",
			{ prompt: "Do work", subagent_type: "finder", background: true },
			undefined,
			undefined,
			createExtensionContext(),
		);
		const stored = manager.get(result.details.task_id);

		expect(stored?.agentMode).toBe("subagent");
		expect(stored?.toolAllowlist).toEqual(["read", "task", "task_cancel", "task_status"]);
		expect(stored?.toolDisallowlist).toEqual(["write"]);
		backgroundResult.resolve({ status: "completed", finalResponse: "done" });
		await manager.wait(result.details.task_id, 100);
	});

	it("#given process agent with inherited tools and disallowed entries #when task starts #then stores active tools minus denied names", async () => {
		const backgroundResult = deferred<RunnerResult>();
		const manager = new TaskManager({
			runner: {
				async run() {
					return await backgroundResult.promise;
				},
			},
		});
		const task = createTaskTool(manager, {
			getActiveTools: () => ["read", "edit", "task", "custom_tool"],
			loadAgents: async () => ({
				finder: {
					name: "finder",
					mode: "subagent",
					permission: [],
					executionMode: "process",
					allowedSubagents: [],
					disallowedTools: ["edit"],
					disable: false,
					prompt: "Find",
					native: false,
				},
			}),
		});

		const result = await task.execute(
			"call_process_tools",
			{ prompt: "Do work", subagent_type: "finder", background: true },
			undefined,
			undefined,
			createExtensionContext(),
		);
		const stored = manager.get(result.details.task_id);

		expect(stored?.toolAllowlist).toEqual(["read", "task", "custom_tool"]);
		expect(stored?.toolDisallowlist).toBeUndefined();
		backgroundResult.resolve({ status: "completed", finalResponse: "done" });
		await manager.wait(result.details.task_id, 100);
	});

	it("#given running background task #when task_cancel executes #then status is cancelled and visible", async () => {
		const manager = new TaskManager({
			runner: {
				async run() {
					await new Promise(() => {});
					return { status: "completed" };
				},
			},
		});
		const started = manager.start({
			prompt: "Do work",
			agentType: "finder",
			parentSessionId: "parent",
			background: true,
		});
		const cancel = createTaskCancelTool(manager);

		const result = await cancel.execute("call_cancel", {
			task_id: started.task.taskId,
			reason: "stop from test",
		});

		expect(result.details).toEqual({ task_id: started.task.taskId, status: "cancelled" });
		expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("Cancelled");
		expect(manager.get(started.task.taskId)?.lastError?.message).toBe("stop from test");
	});

	it("#given nested task beyond default depth #when parent does not allow target #then denies delegation", async () => {
		const manager = new TaskManager({
			runner: {
				async run() {
					return { status: "completed", finalResponse: "should not run" };
				},
			},
		});
		registerInProcessAncestry("parent", {
			taskId: "task_parent",
			agentType: "finder",
			parentSessionId: "root",
			rootSessionId: "root",
			depth: 1,
		});
		const task = createTaskTool(manager, {
			loadAgents: async () => ({
				finder: {
					name: "finder",
					mode: "all",
					permission: [],
					allowedSubagents: [],
					disallowedTools: [],
					disable: false,
					prompt: "Find",
					native: false,
				},
			}),
		});

		const result = await task.execute(
			"call_5",
			{ prompt: "Do nested", subagent_type: "writer" },
			undefined,
			undefined,
			createExtensionContext(),
		);

		expect(result.details.status).toBe("denied");
		expect(result.details.reason).toContain("Task nesting depth");
		expect(manager.list()).toEqual([]);
	});

	it("#given nested task beyond default depth #when parent allowlists target #then starts task", async () => {
		const manager = new TaskManager({
			runner: {
				async run() {
					return { status: "completed", finalResponse: "allowed" };
				},
			},
		});
		registerInProcessAncestry("parent", {
			taskId: "task_parent",
			agentType: "finder",
			parentSessionId: "root",
			rootSessionId: "root",
			depth: 1,
		});
		const task = createTaskTool(manager, {
			loadAgents: async () => ({
				finder: {
					name: "finder",
					mode: "all",
					permission: [],
					allowedSubagents: ["writer"],
					disallowedTools: [],
					disable: false,
					prompt: "Find",
					native: false,
				},
			}),
		});

		const result = await task.execute(
			"call_6",
			{ prompt: "Do nested", subagent_type: "writer" },
			undefined,
			undefined,
			createExtensionContext(),
		);

		expect(result.details.status).toBe("completed");
		expect(manager.get(result.details.task_id)?.depth).toBe(2);
		expect(manager.get(result.details.task_id)?.rootSessionId).toBe("root");
	});
});
