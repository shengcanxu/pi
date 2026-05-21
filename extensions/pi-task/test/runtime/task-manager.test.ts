import { describe, expect, it } from "vitest";

import { TaskManager } from "../../src/runtime/task-manager.js";
import { deferred } from "../helpers/deferred.js";

describe("task manager model fallback", () => {
	it("#given tasks from multiple sessions #when listing for scope #then filters by session task id or all", async () => {
		const manager = new TaskManager({
			runner: {
				async run() {
					return { status: "completed", finalResponse: "ok" };
				},
			},
		});
		const first = manager.start({
			prompt: "do work",
			agentType: "finder",
			parentSessionId: "parent-a",
			rootSessionId: "root-a",
		});
		const second = manager.start({
			prompt: "do work",
			agentType: "writer",
			parentSessionId: "parent-b",
			rootSessionId: "root-b",
		});
		await Promise.all([first.promise, second.promise]);

		expect(manager.listForScope({ sessionId: "root-a" }).map((task) => task.taskId)).toEqual([first.task.taskId]);
		expect(manager.listForScope({ taskId: second.task.taskId }).map((task) => task.taskId)).toEqual([
			second.task.taskId,
		]);
		expect(manager.listForScope({ all: true })).toHaveLength(2);
	});

	it("#given fallback models #when first model fails retryably #then retries with next model in same task", async () => {
		const seenModels: Array<string | undefined> = [];
		const manager = new TaskManager({
			runner: {
				async run({ task }) {
					seenModels.push(task.model);
					if (task.model === "provider/a") {
						return { status: "failed", errorMessage: "provider overloaded" };
					}
					return { status: "completed", finalResponse: `ok:${task.model}` };
				},
			},
		});

		const started = manager.start({
			prompt: "do work",
			agentType: "finder",
			parentSessionId: "parent",
			models: ["provider/a", "provider/b"],
		});

		const task = await started.promise;

		expect(seenModels).toEqual(["provider/a", "provider/b"]);
		expect(task?.status).toBe("completed");
		expect(task?.finalResponse).toBe("ok:provider/b");
		expect(task?.modelAttempts.map((attempt) => attempt.status)).toEqual(["failed", "completed"]);
	});

	it("#given nonretryable failure #when first model fails #then does not try fallback", async () => {
		const seenModels: Array<string | undefined> = [];
		const manager = new TaskManager({
			runner: {
				async run({ task }) {
					seenModels.push(task.model);
					return { status: "failed", errorMessage: "permission denied" };
				},
			},
		});

		const started = manager.start({
			prompt: "do work",
			agentType: "finder",
			parentSessionId: "parent",
			models: ["provider/a", "provider/b"],
		});

		const task = await started.promise;

		expect(seenModels).toEqual(["provider/a"]);
		expect(task?.status).toBe("failed");
		expect(task?.modelAttempts.map((attempt) => attempt.status)).toEqual(["failed", "pending"]);
	});

	it("#given cancellation races with runner failure #when runner rejects after abort #then keeps cancelled state", async () => {
		const runnerStarted = deferred<void>();
		const manager = new TaskManager({
			runner: {
				async run({ signal }) {
					runnerStarted.resolve();
					await new Promise<void>((resolve) => {
						signal?.addEventListener("abort", () => resolve(), { once: true });
					});
					throw new Error("late runner failure");
				},
			},
		});
		const started = manager.start({
			prompt: "do work",
			agentType: "finder",
			parentSessionId: "parent",
			background: true,
		});
		await runnerStarted.promise;

		const cancelled = manager.cancel(started.task.taskId, "stop from test");
		const final = await started.promise;

		expect(cancelled?.status).toBe("cancelled");
		expect(final?.status).toBe("cancelled");
		expect(final?.lastError?.message).toBe("stop from test");
		expect(manager.get(started.task.taskId)?.status).toBe("cancelled");
	});

	it("#given host abort signal #when task is cancelled #then runner observes cancellation", async () => {
		const runnerStarted = deferred<void>();
		const releaseRunner = deferred<void>();
		const hostController = new AbortController();
		let runnerSignal: AbortSignal | undefined;
		const manager = new TaskManager({
			runner: {
				async run({ signal }) {
					runnerSignal = signal;
					runnerStarted.resolve();
					await releaseRunner.promise;
					return { status: signal?.aborted ? "cancelled" : "completed" };
				},
			},
		});
		const started = manager.start({
			prompt: "do work",
			agentType: "finder",
			parentSessionId: "parent",
			background: true,
			signal: hostController.signal,
		});
		await runnerStarted.promise;

		manager.cancel(started.task.taskId, "stop from test");

		try {
			expect(runnerSignal?.aborted).toBe(true);
		} finally {
			releaseRunner.resolve();
		}
		const final = await started.promise;
		expect(final?.status).toBe("cancelled");
	});

	it("#given task lifecycle changes #when manager updates state #then emits task change callbacks", async () => {
		const seenStatuses: string[] = [];
		const manager = new TaskManager({
			onTaskChange: (task) => {
				seenStatuses.push(task.status);
			},
			runner: {
				async run({ onUpdate }) {
					onUpdate?.({ type: "progress", message: "working" });
					return { status: "completed", finalResponse: "done" };
				},
			},
		});

		const started = manager.start({
			prompt: "do work",
			agentType: "finder",
			parentSessionId: "parent",
		});
		await started.promise;

		expect(seenStatuses).toEqual(expect.arrayContaining(["running", "completed"]));
	});
});
