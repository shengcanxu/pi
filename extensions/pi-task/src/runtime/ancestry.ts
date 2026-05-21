export type TaskAncestry = {
	taskId: string;
	agentType: string;
	parentSessionId: string;
	rootSessionId: string;
	depth: number;
};

const inProcessAncestry = new Map<string, TaskAncestry>();

export function registerInProcessAncestry(sessionId: string, ancestry: TaskAncestry): void {
	inProcessAncestry.set(sessionId, ancestry);
}

export function clearInProcessAncestry(sessionId: string): void {
	inProcessAncestry.delete(sessionId);
}

export function getInProcessAncestry(sessionId: string): TaskAncestry | undefined {
	return inProcessAncestry.get(sessionId);
}

export function getEnvironmentAncestry(): TaskAncestry | undefined {
	const taskId = process.env["PI_TASK_PARENT_TASK_ID"];
	const agentType = process.env["PI_TASK_AGENT_TYPE"];
	const parentSessionId = process.env["PI_TASK_PARENT_SESSION_ID"];
	const rootSessionId = process.env["PI_TASK_ROOT_SESSION_ID"];
	const depthRaw = process.env["PI_TASK_DEPTH"];
	if (
		taskId === undefined ||
		agentType === undefined ||
		parentSessionId === undefined ||
		rootSessionId === undefined ||
		depthRaw === undefined
	) {
		return undefined;
	}
	const depth = Number.parseInt(depthRaw, 10);
	if (!Number.isFinite(depth)) return undefined;
	return { taskId, agentType, parentSessionId, rootSessionId, depth };
}
