import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ResultStore } from "../../src/runtime/result-store.js";
import type { RunnerResult } from "../../src/runtime/task-manager.js";
import { TaskManager } from "../../src/runtime/task-manager.js";
import type { TaskRecord } from "../../src/runtime/types.js";
import { deferred } from "../helpers/deferred.js";

const tempDirs: string[] = [];

async function makeStore(): Promise<ResultStore> {
	const dir = await mkdtemp(path.join(os.tmpdir(), "pi-task-manager-store-"));
	tempDirs.push(dir);
	return new ResultStore(dir);
}

async function waitForPersistedTask(
	store: ResultStore,
	taskId: string,
	predicate: (task: TaskRecord) => boolean,
): Promise<TaskRecord> {
	const deadline = Date.now() + 500;
	while (Date.now() <= deadline) {
		const task = await store.load(taskId);
		if (task !== null && predicate(task)) return task;
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
	throw new Error(`Timed out waiting for persisted task ${taskId}.`);
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task manager persistence", () => {
	it("#given completed task #when task finishes #then final response is persisted for later status reads", async () => {
		const store = await makeStore();
		const manager = new TaskManager({
			resultStore: store,
			runner: {
				async run() {
					return { status: "completed", finalResponse: "persisted final" };
				},
			},
		});

		const started = manager.start({ prompt: "work", agentType: "finder", parentSessionId: "parent" });
		const task = await started.promise;

		expect((await store.load(task?.taskId ?? ""))?.finalResponse).toBe("persisted final");
	});

	it("#given persisted running process task #when manager resumes #then task is restored as lost if process cannot be observed", async () => {
		const store = await makeStore();
		const first = new TaskManager({
			resultStore: store,
			runner: {
				async run() {
					await new Promise(() => {});
					return { status: "completed" };
				},
			},
		});
		const started = first.start({
			prompt: "work",
			agentType: "finder",
			parentSessionId: "parent",
			executionMode: "process",
			background: true,
		});

		await waitForPersistedTask(store, started.task.taskId, (task) => task.status === "running");
		const second = new TaskManager({
			resultStore: store,
			isPidAlive: () => false,
			runner: {
				async run() {
					return { status: "completed" };
				},
			},
		});
		await second.resume({ cwd: process.cwd(), reason: "resume" });

		const restored = second.get(started.task.taskId);
		expect(restored?.status).toBe("lost");
		expect(restored?.lastError?.message).toContain("cannot be observed");
	});

	it("#given running process task #when runner reports pid and heartbeat #then status and store are updated before completion", async () => {
		const store = await makeStore();
		const finish = deferred<RunnerResult>();
		const manager = new TaskManager({
			resultStore: store,
			runner: {
				async run({ onUpdate }) {
					onUpdate?.({ type: "pid", pid: 4321 });
					onUpdate?.({ type: "heartbeat", pid: 4321 });
					return await finish.promise;
				},
			},
		});
		const started = manager.start({
			prompt: "work",
			agentType: "finder",
			parentSessionId: "parent",
			executionMode: "process",
			background: true,
		});

		const persisted = await waitForPersistedTask(
			store,
			started.task.taskId,
			(task) => task.pid === 4321 && task.heartbeatAt !== undefined,
		);
		const running = manager.get(started.task.taskId);
		expect(running?.pid).toBe(4321);
		expect(running?.heartbeatAt).toBeTypeOf("number");
		expect(persisted.pid).toBe(4321);
		expect(persisted.heartbeatAt).toBeTypeOf("number");

		finish.resolve({ status: "completed", finalResponse: "done" });
		await started.promise;
	});

	it("#given running task #when cancelled #then abort signal and persisted status are updated", async () => {
		const store = await makeStore();
		const signalReady = deferred<AbortSignal | undefined>();
		const manager = new TaskManager({
			resultStore: store,
			runner: {
				async run({ signal }) {
					signalReady.resolve(signal);
					await new Promise(() => {});
					return { status: "completed" };
				},
			},
		});
		const started = manager.start({
			prompt: "work",
			agentType: "finder",
			parentSessionId: "parent",
			background: true,
		});
		const signal = await signalReady.promise;
		let aborted = false;
		signal?.addEventListener("abort", () => {
			aborted = true;
		});

		const cancelled = manager.cancel(started.task.taskId, "stop");

		expect(cancelled?.status).toBe("cancelled");
		expect(aborted).toBe(true);
		const persisted = await waitForPersistedTask(store, started.task.taskId, (task) => task.status === "cancelled");
		expect(persisted.lastError?.message).toBe("stop");
	});
});
