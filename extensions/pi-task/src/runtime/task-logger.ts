import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type TaskLogEvent = {
	type: string;
	taskId: string;
	timestamp: number;
	data?: Record<string, unknown>;
};

const SECRET_KEY_PATTERN = /(?:token|password|secret|authorization|api[_-]?key|key)$/i;

function redactValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactValue);
	}

	if (typeof value === "object" && value !== null) {
		const redacted: Record<string, unknown> = {};
		for (const [key, nestedValue] of Object.entries(value)) {
			redacted[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redactValue(nestedValue);
		}
		return redacted;
	}

	return value;
}

export class TaskEventLogger {
	readonly #rootDir: string;

	constructor(rootDir: string) {
		this.#rootDir = rootDir;
	}

	getLogPath(taskId: string): string {
		return path.join(this.#rootDir, "logs", `${taskId}.jsonl`);
	}

	async write(taskId: string, event: TaskLogEvent): Promise<void> {
		const filePath = this.getLogPath(taskId);
		await mkdir(path.dirname(filePath), { recursive: true });
		const redacted = redactValue(event);
		await appendFile(filePath, `${JSON.stringify(redacted)}\n`, "utf-8");
	}
}
