import * as os from "node:os";
import * as path from "node:path";

export function getSenpiAgentDir(): string {
	return process.env["PI_TASK_AGENT_DIR"] ?? path.join(os.homedir(), ".senpi", "agent");
}

export function getTaskStateDir(): string {
	return process.env["PI_TASK_STATE_DIR"] ?? path.join(os.homedir(), ".senpi", "task");
}
