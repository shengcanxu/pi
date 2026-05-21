import * as fs from "node:fs";
import * as path from "node:path";
import { loadAllAgents } from "../agents/loader.js";
import type { AgentInfo } from "../agents/schema.js";
import { ProcessRunner, type ProcessRunnerInput, type ProcessRunnerResult } from "./process-runner.js";
import type { RunnerInput, RunnerResult, TaskRunner } from "./task-manager.js";

type ProcessTaskRunnerOptions = {
	loadAgents?: (cwd: string) => Promise<Record<string, AgentInfo>>;
	processRunner?: Pick<ProcessRunner, "run">;
};

type TextBlock = {
	type: "text";
	text: string;
};

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isRunnableScript =
		currentScript !== undefined && fs.existsSync(currentScript) && !currentScript.startsWith("/$bunfs/root/");
	if (isRunnableScript) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	if (/^(node|bun)(\.exe)?$/.test(execName)) {
		return { command: "pi", args };
	}
	return { command: process.execPath, args };
}

function extractAssistantTextFromJsonLines(output: string | undefined): string | undefined {
	if (output === undefined) return undefined;
	const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);
	for (let index = lines.length - 1; index >= 0; index--) {
		const line = lines[index];
		if (line === undefined) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (typeof parsed !== "object" || parsed === null || !("message" in parsed)) continue;
		const message = parsed.message;
		if (
			typeof message !== "object" ||
			message === null ||
			!("role" in message) ||
			message.role !== "assistant" ||
			!("content" in message) ||
			!Array.isArray(message.content)
		) {
			continue;
		}
		const text = message.content
			.filter(
				(block): block is TextBlock => block.type === "text" && "text" in block && typeof block.text === "string",
			)
			.map((block) => block.text)
			.join("\n")
			.trim();
		if (text.length > 0) return text;
	}
	return output.trim().length > 0 ? output.trim() : undefined;
}

function buildPrompt(task: RunnerInput["task"], agent: AgentInfo | undefined): string {
	const lines = [
		`You are running as pi-task process subagent "${task.agentType}".`,
		`Parent session: ${task.parentSessionId}.`,
		`Root session: ${task.rootSessionId}.`,
		`Task id: ${task.taskId}.`,
	];
	if (agent?.prompt) {
		lines.push("", "Subagent instructions:", agent.prompt);
	}
	lines.push("", "Task:", task.prompt);
	return lines.join("\n");
}

export class ProcessTaskRunner implements TaskRunner {
	readonly #loadAgents: (cwd: string) => Promise<Record<string, AgentInfo>>;
	readonly #processRunner: Pick<ProcessRunner, "run">;

	constructor(options: ProcessTaskRunnerOptions = {}) {
		this.#loadAgents = options.loadAgents ?? loadAllAgents;
		this.#processRunner = options.processRunner ?? new ProcessRunner();
	}

	async run(input: RunnerInput): Promise<RunnerResult> {
		const cwd = input.task.cwd ?? process.cwd();
		const agents = await this.#loadAgents(cwd);
		const agent = agents[input.task.agentType] ?? agents["default"];
		const args = ["--mode", "json", "-p", "--no-session"];
		if (input.task.model !== undefined) {
			args.push("--model", input.task.model);
		}
		if (input.task.toolAllowlist !== undefined) {
			if (input.task.toolAllowlist.length === 0) {
				args.push("--no-tools");
			} else {
				args.push("--tools", input.task.toolAllowlist.join(","));
			}
		}
		args.push(buildPrompt(input.task, agent));
		const invocation = getPiInvocation(args);
		const processInput = {
			command: invocation.command,
			args: invocation.args,
			cwd,
			taskId: input.task.taskId,
			agentType: input.task.agentType,
			parentSessionId: input.task.parentSessionId,
			rootSessionId: input.task.rootSessionId,
			depth: input.task.depth,
			...(input.signal !== undefined && { signal: input.signal }),
			onEvent: (event) => {
				if (event.type === "started") {
					input.onUpdate?.({ type: "pid", pid: event.pid });
					return;
				}
				if (event.type === "heartbeat") {
					input.onUpdate?.({ type: "heartbeat", pid: event.pid });
				}
			},
		} satisfies ProcessRunnerInput;
		const result = await this.#processRunner.run(processInput);
		return mapProcessResult(result);
	}
}

function mapProcessResult(result: ProcessRunnerResult): RunnerResult {
	return {
		status: result.status,
		...(result.pid !== undefined && { pid: result.pid }),
		...(result.processExit !== undefined && { processExit: result.processExit }),
		...(result.status === "completed"
			? { finalResponse: extractAssistantTextFromJsonLines(result.finalResponse) ?? "" }
			: { errorMessage: result.errorMessage ?? `Process task exited with status ${result.status}.` }),
	};
}
