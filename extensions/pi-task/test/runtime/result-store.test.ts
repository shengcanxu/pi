import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ResultStore } from "../../src/runtime/result-store.js";
import { createTaskRecord, transitionTask } from "../../src/runtime/task-state.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
	const dir = await mkdtemp(path.join(os.tmpdir(), "pi-task-store-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("result store", () => {
	it("#given completed task #when reloading store #then final response is still present", async () => {
		const dir = await makeTempDir();
		const store = new ResultStore(dir);
		const task = transitionTask(
			transitionTask(
				createTaskRecord({
					taskId: "task_final",
					agentType: "finder",
					prompt: "Find",
					parentSessionId: "parent",
					rootSessionId: "parent",
					depth: 0,
					executionMode: "in-process",
				}),
				{ status: "running", now: 2 },
			),
			{ status: "completed", now: 3, finalResponse: "Final answer" },
		);

		await store.save(task);
		const reloaded = await new ResultStore(dir).load("task_final");

		expect(reloaded?.finalResponse).toBe("Final answer");
	});

	it("#given multiple persisted tasks #when listing #then returns known task records", async () => {
		const dir = await makeTempDir();
		const store = new ResultStore(dir);
		const first = createTaskRecord({
			taskId: "task_a",
			agentType: "finder",
			prompt: "Find",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "in-process",
		});
		const second = createTaskRecord({
			taskId: "task_b",
			agentType: "writer",
			prompt: "Write",
			parentSessionId: "parent",
			rootSessionId: "parent",
			depth: 0,
			executionMode: "process",
		});

		await store.save(first);
		await store.save(second);

		expect((await store.list()).map((task) => task.taskId).sort()).toEqual(["task_a", "task_b"]);
	});
});
