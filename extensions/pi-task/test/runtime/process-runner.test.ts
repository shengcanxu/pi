import { describe, expect, it } from "vitest";

import { ProcessRunner } from "../../src/runtime/process-runner.js";

describe("process runner", () => {
	it("#given long running child #when externally killed #then reports killed with pid", async () => {
		const runner = new ProcessRunner();
		let pid: number | undefined;
		const resultPromise = runner.run({
			command: process.execPath,
			args: ["-e", "setInterval(() => {}, 1000)"],
			taskId: "task_process",
			onEvent(event) {
				if (event.type === "started") {
					pid = event.pid;
					process.kill(event.pid, "SIGTERM");
				}
			},
		});

		const result = await resultPromise;

		expect(pid).toBeTypeOf("number");
		expect(result.status).toBe("killed");
		expect(result.pid).toBe(pid);
		expect(result.processExit).toEqual({ signal: "SIGTERM" });
	});
});
