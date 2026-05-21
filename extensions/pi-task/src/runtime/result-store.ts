import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TaskRecord } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTaskRecord(value: unknown): value is TaskRecord {
	if (!isRecord(value)) return false;
	return (
		typeof value["taskId"] === "string" &&
		typeof value["agentType"] === "string" &&
		typeof value["prompt"] === "string" &&
		typeof value["status"] === "string"
	);
}

export class ResultStore {
	readonly #rootDir: string;

	constructor(rootDir: string) {
		this.#rootDir = rootDir;
	}

	getTaskPath(taskId: string): string {
		return path.join(this.#rootDir, "tasks", `${taskId}.json`);
	}

	async save(task: TaskRecord): Promise<void> {
		const filePath = this.getTaskPath(task.taskId);
		await mkdir(path.dirname(filePath), { recursive: true });
		const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
		await writeFile(tempPath, `${JSON.stringify(task, null, 2)}\n`, "utf-8");
		await rename(tempPath, filePath);
	}

	async load(taskId: string): Promise<TaskRecord | null> {
		try {
			const raw = await readFile(this.getTaskPath(taskId), "utf-8");
			const parsed: unknown = JSON.parse(raw);
			return isTaskRecord(parsed) ? parsed : null;
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") {
				return null;
			}
			throw error;
		}
	}

	async list(): Promise<TaskRecord[]> {
		const tasksDir = path.join(this.#rootDir, "tasks");
		let entries: string[];
		try {
			entries = await readdir(tasksDir);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") {
				return [];
			}
			throw error;
		}
		const tasks: TaskRecord[] = [];
		for (const entry of entries) {
			if (!entry.endsWith(".json")) continue;
			const task = await this.load(path.basename(entry, ".json"));
			if (task !== null) tasks.push(task);
		}
		return tasks;
	}
}
