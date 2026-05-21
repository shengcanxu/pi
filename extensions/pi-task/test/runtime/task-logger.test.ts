import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { TaskEventLogger } from "../../src/runtime/task-logger.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
	const dir = await mkdtemp(path.join(os.tmpdir(), "pi-task-logger-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task event logger", () => {
	it("#given secret-like fields #when logging #then redacts values but keeps task context", async () => {
		const dir = await makeTempDir();
		const logger = new TaskEventLogger(dir);

		await logger.write("task_1", {
			type: "tool_call",
			taskId: "task_1",
			timestamp: 1,
			data: {
				token: "secret-token",
				password: "secret-password",
				keep: "visible",
			},
		});

		const content = await readFile(logger.getLogPath("task_1"), "utf-8");

		expect(content).toContain("task_1");
		expect(content).toContain("[redacted]");
		expect(content).toContain("visible");
		expect(content).not.toContain("secret-token");
		expect(content).not.toContain("secret-password");
	});
});
