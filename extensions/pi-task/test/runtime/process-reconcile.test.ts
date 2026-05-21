import { describe, expect, it } from "vitest";

import { reconcileProcessTask } from "../../src/runtime/process-reconcile.js";
import { createTaskRecord, transitionTask } from "../../src/runtime/task-state.js";

describe("process task reconciliation", () => {
	it("#given resumed running process with missing pid #when reconciling #then marks lost with explanation", () => {
		const task = transitionTask(
			createTaskRecord({
				taskId: "task_lost",
				agentType: "finder",
				prompt: "Long task",
				parentSessionId: "parent",
				rootSessionId: "parent",
				depth: 0,
				executionMode: "process",
				pid: 404,
				now: 1,
			}),
			{ status: "running", now: 2, heartbeatAt: 2 },
		);

		const reconciled = reconcileProcessTask(task, {
			now: 20_000,
			heartbeatTimeoutMs: 1_000,
			isPidAlive: () => false,
		});

		expect(reconciled.status).toBe("lost");
		expect(reconciled.pid).toBe(404);
		expect(reconciled.lastError?.message).toContain("disappeared");
	});
});
