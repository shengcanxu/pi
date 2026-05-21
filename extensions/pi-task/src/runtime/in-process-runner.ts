import type { Api, Model } from "@mariozechner/pi-ai";
import {
	type AgentSession,
	AuthStorage,
	createAgentSession,
	ModelRegistry,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import { loadAllAgents } from "../agents/loader.js";
import type { AgentInfo } from "../agents/schema.js";
import { clearInProcessAncestry, registerInProcessAncestry } from "./ancestry.js";
import type { RunnerInput, RunnerResult, TaskRunner } from "./task-manager.js";

type TextBlock = {
	type: "text";
	text: string;
};

type AssistantLikeMessage = {
	role: "assistant";
	content: Array<TextBlock | { type: string }>;
};

type SessionLike = {
	sessionId: string;
	state: {
		messages: readonly unknown[];
	};
	subscribe(listener: (event: { type: string }) => void): () => void;
	getActiveToolNames?: () => string[];
	setActiveToolsByName?: (toolNames: string[]) => void;
	prompt(prompt: string): Promise<void>;
	abort?: () => Promise<void>;
	dispose?: () => void;
};

type CreateSessionInput = {
	cwd: string;
	model?: Model<Api>;
	tools?: string[];
	persistSession: false;
};

type InProcessRunnerOptions = {
	agentDir?: string;
	loadAgents?: (cwd: string) => Promise<Record<string, AgentInfo>>;
	createSession?: (input: CreateSessionInput) => Promise<SessionLike>;
};

function isAssistantMessage(message: unknown): message is AssistantLikeMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		"role" in message &&
		message.role === "assistant" &&
		"content" in message &&
		Array.isArray(message.content)
	);
}

function extractLastAssistantText(messages: readonly unknown[]): string | undefined {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!isAssistantMessage(message)) continue;
		const text = message.content
			.filter(
				(block): block is TextBlock => block.type === "text" && "text" in block && typeof block.text === "string",
			)
			.map((block) => block.text)
			.join("\n")
			.trim();
		if (text.length > 0) return text;
	}
	return undefined;
}

function buildSubagentPrompt(task: RunnerInput["task"], agent: AgentInfo | undefined): string {
	const lines = [
		`You are running as pi-task subagent "${task.agentType}".`,
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

function resolveModel(label: string | undefined, registry: ModelRegistry): Model<Api> | undefined {
	if (label === undefined || label === "inherit") return undefined;
	const slash = label.indexOf("/");
	if (slash <= 0) return undefined;
	return registry.find(label.slice(0, slash), label.slice(slash + 1));
}

async function createDefaultSession(input: CreateSessionInput, agentDir?: string): Promise<AgentSession> {
	const authStorage = AuthStorage.create(agentDir === undefined ? undefined : `${agentDir}/auth.json`);
	const modelRegistry = ModelRegistry.create(
		authStorage,
		agentDir === undefined ? undefined : `${agentDir}/models.json`,
	);
	const model = input.model;
	const { session } = await createAgentSession({
		cwd: input.cwd,
		...(agentDir !== undefined && { agentDir }),
		authStorage,
		modelRegistry,
		sessionManager: SessionManager.inMemory(),
		...(input.tools !== undefined && { tools: input.tools }),
		...(model !== undefined && { model }),
	});
	return session;
}

export class InProcessRunner implements TaskRunner {
	readonly #agentDir: string | undefined;
	readonly #loadAgents: (cwd: string) => Promise<Record<string, AgentInfo>>;
	readonly #createSession: (input: CreateSessionInput) => Promise<SessionLike>;

	constructor(options: InProcessRunnerOptions = {}) {
		this.#agentDir = options.agentDir;
		this.#loadAgents = options.loadAgents ?? loadAllAgents;
		this.#createSession = options.createSession ?? ((input) => createDefaultSession(input, this.#agentDir));
	}

	async run(input: RunnerInput): Promise<RunnerResult> {
		const cwd = input.task.cwd ?? process.cwd();
		const authStorage = AuthStorage.create(this.#agentDir === undefined ? undefined : `${this.#agentDir}/auth.json`);
		const registry = ModelRegistry.create(
			authStorage,
			this.#agentDir === undefined ? undefined : `${this.#agentDir}/models.json`,
		);
		const model = resolveModel(input.task.model, registry);
		const agents = await this.#loadAgents(cwd);
		const agent = agents[input.task.agentType] ?? agents["default"];
		const session = await this.#createSession({
			cwd,
			persistSession: false,
			...(model !== undefined && { model }),
			...(input.task.toolAllowlist !== undefined && { tools: input.task.toolAllowlist }),
		});
		if (input.task.toolAllowlist === undefined && input.task.toolDisallowlist !== undefined) {
			const activeTools = session.getActiveToolNames?.();
			if (activeTools !== undefined) {
				const disallowed = new Set(input.task.toolDisallowlist);
				session.setActiveToolsByName?.(activeTools.filter((tool) => !disallowed.has(tool)));
			}
		}
		registerInProcessAncestry(session.sessionId, {
			taskId: input.task.taskId,
			agentType: input.task.agentType,
			parentSessionId: input.task.parentSessionId,
			rootSessionId: input.task.rootSessionId,
			depth: input.task.depth,
		});
		let aborted = false;
		const abort = (): void => {
			aborted = true;
			void session.abort?.();
		};
		if (input.signal?.aborted) abort();
		input.signal?.addEventListener("abort", abort, { once: true });

		try {
			await session.prompt(buildSubagentPrompt(input.task, agent));
			if (aborted) {
				return {
					status: "cancelled",
					childSessionId: session.sessionId,
					errorMessage: "In-process task was cancelled.",
				};
			}
			return {
				status: "completed",
				childSessionId: session.sessionId,
				finalResponse: extractLastAssistantText(session.state.messages) ?? "",
			};
		} catch (error) {
			return {
				status: aborted ? "cancelled" : "failed",
				childSessionId: session.sessionId,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		} finally {
			session.dispose?.();
			clearInProcessAncestry(session.sessionId);
		}
	}
}
