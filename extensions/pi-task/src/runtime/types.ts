export type Action = "allow" | "deny" | "ask";

export type Rule = {
	permission: string;
	pattern: string;
	action: Action;
};

export type Ruleset = Rule[];

export type PermissionConfig = Record<string, Action | Record<string, Action>>;

export type AgentMode = "primary" | "subagent" | "all";

export type ExecutionMode = "in-process" | "process";

export type TaskStatus = "queued" | "running" | "retrying" | "completed" | "failed" | "cancelled" | "killed" | "lost";

export type TaskError = {
	message: string;
	code?: string;
	at: number;
};

export type ProcessExit = {
	code?: number;
	signal?: string;
};

export type ModelAttempt = {
	model: string;
	status: "pending" | "running" | "failed" | "completed";
	errorMessage?: string;
	startedAt?: number;
	endedAt?: number;
};

export type TaskRecord = {
	taskId: string;
	agentType: string;
	agentMode?: AgentMode;
	prompt: string;
	description?: string;
	parentSessionId: string;
	rootSessionId: string;
	childSessionId?: string;
	cwd?: string;
	parentAgentType?: string;
	depth: number;
	executionMode: ExecutionMode;
	pid?: number;
	status: TaskStatus;
	createdAt: number;
	updatedAt: number;
	startedAt?: number;
	endedAt?: number;
	model?: string;
	modelAttempts: ModelAttempt[];
	processExit?: ProcessExit;
	toolAllowlist?: string[];
	toolDisallowlist?: string[];
	heartbeatAt?: number;
	progress: string[];
	finalResponse?: string;
	lastError?: TaskError;
	resumeState?: "fresh" | "resumed" | "reconciled";
	logPath?: string;
};

export type CreateTaskRecordInput = {
	taskId: string;
	agentType: string;
	agentMode?: AgentMode;
	prompt: string;
	description?: string;
	parentSessionId: string;
	rootSessionId: string;
	childSessionId?: string;
	cwd?: string;
	parentAgentType?: string;
	depth: number;
	executionMode: ExecutionMode;
	pid?: number;
	model?: string;
	modelAttempts?: ModelAttempt[];
	processExit?: ProcessExit;
	toolAllowlist?: string[];
	toolDisallowlist?: string[];
	now?: number;
};
