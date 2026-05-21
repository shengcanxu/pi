import type { CreateTaskRecordInput, TaskRecord, TaskStatus } from "./types.js";

type TransitionInput = {
	status: TaskStatus;
	now: number;
	pid?: number;
	childSessionId?: string;
	progress?: string;
	finalResponse?: string;
	errorMessage?: string;
	errorCode?: string;
	processExit?: TaskRecord["processExit"];
	heartbeatAt?: number;
	model?: string;
};

const TERMINAL_STATUSES = new Set<TaskStatus>(["completed", "failed", "cancelled", "killed", "lost"]);

const ALLOWED_TRANSITIONS = new Map<TaskStatus, Set<TaskStatus>>([
	["queued", new Set(["running", "cancelled", "failed"])],
	["running", new Set(["retrying", "completed", "failed", "cancelled", "killed", "lost"])],
	["retrying", new Set(["running", "completed", "failed", "cancelled", "killed", "lost"])],
	["completed", new Set()],
	["failed", new Set()],
	["cancelled", new Set()],
	["killed", new Set()],
	["lost", new Set()],
]);

export class InvalidTaskTransitionError extends Error {
	constructor(from: TaskStatus, to: TaskStatus) {
		super(`Invalid task transition: ${from} -> ${to}`);
		this.name = "InvalidTaskTransitionError";
	}
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
	return TERMINAL_STATUSES.has(status);
}

export function createTaskRecord(input: CreateTaskRecordInput): TaskRecord {
	const now = input.now ?? Date.now();
	return {
		taskId: input.taskId,
		agentType: input.agentType,
		...(input.agentMode !== undefined && { agentMode: input.agentMode }),
		prompt: input.prompt,
		...(input.description !== undefined && { description: input.description }),
		parentSessionId: input.parentSessionId,
		rootSessionId: input.rootSessionId,
		...(input.childSessionId !== undefined && { childSessionId: input.childSessionId }),
		...(input.cwd !== undefined && { cwd: input.cwd }),
		...(input.parentAgentType !== undefined && { parentAgentType: input.parentAgentType }),
		depth: input.depth,
		executionMode: input.executionMode,
		...(input.pid !== undefined && { pid: input.pid }),
		status: "queued",
		createdAt: now,
		updatedAt: now,
		...(input.model !== undefined && { model: input.model }),
		modelAttempts: input.modelAttempts ?? [],
		...(input.processExit !== undefined && { processExit: input.processExit }),
		...(input.toolAllowlist !== undefined && { toolAllowlist: input.toolAllowlist }),
		...(input.toolDisallowlist !== undefined && { toolDisallowlist: input.toolDisallowlist }),
		progress: [],
		resumeState: "fresh",
	};
}

export function transitionTask(task: TaskRecord, input: TransitionInput): TaskRecord {
	if (task.status !== input.status && !ALLOWED_TRANSITIONS.get(task.status)?.has(input.status)) {
		throw new InvalidTaskTransitionError(task.status, input.status);
	}

	const progress = input.progress === undefined ? task.progress : [...task.progress, input.progress];
	const next: TaskRecord = {
		...task,
		status: input.status,
		updatedAt: input.now,
		progress,
		...(input.pid !== undefined && { pid: input.pid }),
		...(input.childSessionId !== undefined && { childSessionId: input.childSessionId }),
		...(input.heartbeatAt !== undefined && { heartbeatAt: input.heartbeatAt }),
		...(input.model !== undefined && { model: input.model }),
		...(input.finalResponse !== undefined && { finalResponse: input.finalResponse }),
		...(input.processExit !== undefined && { processExit: input.processExit }),
	};

	if (input.status === "running" && task.startedAt === undefined) {
		next.startedAt = input.now;
	}

	if (isTerminalTaskStatus(input.status)) {
		next.endedAt = input.now;
	}

	if (input.errorMessage !== undefined) {
		next.lastError = {
			message: input.errorMessage,
			...(input.errorCode !== undefined && { code: input.errorCode }),
			at: input.now,
		};
	}

	return next;
}
