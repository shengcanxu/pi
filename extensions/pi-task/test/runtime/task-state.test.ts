import { describe, expect, it } from "vitest";

import { createTaskRecord, transitionTask } from "../../src/runtime/task-state.js";

describe("task lifecycle state", () => {
	it("#given completed task #when transitioning #then final response remains visible", () => {
		const task = createTaskRecord({
			taskId: "task_1",
			agentType: "finder",
			prompt: "Find facts",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "in-process",
		});

		const running = transitionTask(task, { status: "running", now: 2 });
		const completed = transitionTask(running, { status: "completed", now: 3, finalResponse: "Done" });

		expect(completed.status).toBe("completed");
		expect(completed.finalResponse).toBe("Done");
	});

	it("#given killed task #when transitioning #then pid and reason remain visible", () => {
		const task = createTaskRecord({
			taskId: "task_2",
			agentType: "finder",
			prompt: "Long task",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "process",
			pid: 12345,
		});

		const running = transitionTask(task, { status: "running", now: 2, pid: 12345 });
		const killed = transitionTask(running, { status: "killed", now: 3, errorMessage: "Process exited externally" });

		expect(killed.status).toBe("killed");
		expect(killed.pid).toBe(12345);
		expect(killed.lastError?.message).toContain("externally");
	});

	it("#given completed task #when moving back to running #then throws invalid transition", () => {
		const task = createTaskRecord({
			taskId: "task_3",
			agentType: "finder",
			prompt: "Done task",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "in-process",
		});
		const completed = transitionTask(transitionTask(task, { status: "running", now: 2 }), {
			status: "completed",
			now: 3,
			finalResponse: "Done",
		});

		expect(() => transitionTask(completed, { status: "running", now: 4 })).toThrow("Invalid task transition");
	});
});
