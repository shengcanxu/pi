import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { ProcessRunner } = await jiti.import("../src/runtime/process-runner.ts");

const runner = new ProcessRunner();
let pid;
const result = await runner.run({
	command: process.execPath,
	args: ["-e", "setInterval(() => {}, 1000)"],
	taskId: "qa_process_kill",
	onEvent(event) {
		if (event.type === "started") {
			pid = event.pid;
			process.kill(event.pid, "SIGTERM");
		}
	},
});

if (typeof pid !== "number") {
	throw new Error("No child pid was reported");
}
if (result.status !== "killed") {
	throw new Error(`Expected killed status, got ${result.status}`);
}
if (result.pid !== pid) {
	throw new Error(`Expected result pid ${pid}, got ${result.pid}`);
}

console.log(`process kill ok: pid ${pid} -> ${result.status}`);
