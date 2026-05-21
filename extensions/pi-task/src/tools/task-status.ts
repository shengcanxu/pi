import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import type { TaskManager } from "../runtime/task-manager.js";

export type TaskStatusDetails = {
	task_id: string;
	status: string;
	agent_type?: string;
	agent_mode?: string;
	execution_mode?: string;
	model?: string;
	pid?: number;
	process_exit?: {
		code?: number;
		signal?: string;
	};
	child_session_id?: string;
	parent_session_id?: string;
	root_session_id?: string;
	model_attempts?: Array<{
		model: string;
		status: string;
		error_message?: string;
	}>;
	resume_state?: string;
	progress?: string[];
	final_response?: string;
	error_message?: string;
	tool_allowlist?: string[];
	tool_disallowlist?: string[];
};

export const TaskStatusParams = Type.Object({
	task_id: Type.String(),
	wait: Type.Optional(Type.Boolean()),
	timeout_ms: Type.Optional(Type.Integer({ minimum: 0 })),
});

export function createTaskStatusTool(manager: TaskManager) {
	return {
		name: "task_status",
		label: "Task Status",
		description:
			"Inspect a task by id, including background final response, errors, pids, resume state, and killed/lost states.",
		parameters: TaskStatusParams,
		async execute(
			_toolCallId: string,
			params: { task_id: string; wait?: boolean; timeout_ms?: number },
		): Promise<AgentToolResult<TaskStatusDetails>> {
			const task = params.wait
				? await manager.wait(params.task_id, params.timeout_ms ?? 30_000)
				: manager.get(params.task_id);
			if (task === undefined) {
				return {
					content: [{ type: "text", text: `Task ${params.task_id} was not found.` }],
					details: { task_id: params.task_id, status: "missing" },
				};
			}
			const parts = [`${task.taskId}: ${task.status}`];
			parts.push(`agent ${task.agentType}`);
			parts.push(`mode ${task.executionMode}`);
			if (task.model !== undefined) parts.push(`model ${task.model}`);
			if (task.pid !== undefined) parts.push(`pid ${task.pid}`);
			if (task.processExit?.code !== undefined) parts.push(`exit code ${task.processExit.code}`);
			if (task.processExit?.signal !== undefined) parts.push(`exit signal ${task.processExit.signal}`);
			if (task.childSessionId !== undefined) parts.push(`child ${task.childSessionId}`);
			parts.push(`parent ${task.parentSessionId}`);
			if (task.resumeState !== undefined) parts.push(`resume ${task.resumeState}`);
			if (task.finalResponse !== undefined) parts.push(task.finalResponse);
			if (task.lastError !== undefined) parts.push(task.lastError.message);
			return {
				content: [{ type: "text", text: parts.join("\n") }],
				details: {
					task_id: task.taskId,
					status: task.status,
					agent_type: task.agentType,
					...(task.agentMode !== undefined && { agent_mode: task.agentMode }),
					execution_mode: task.executionMode,
					...(task.model !== undefined && { model: task.model }),
					...(task.pid !== undefined && { pid: task.pid }),
					...(task.processExit !== undefined && { process_exit: task.processExit }),
					...(task.childSessionId !== undefined && { child_session_id: task.childSessionId }),
					parent_session_id: task.parentSessionId,
					root_session_id: task.rootSessionId,
					...(task.modelAttempts.length > 0 && {
						model_attempts: task.modelAttempts.map((attempt) => ({
							model: attempt.model,
							status: attempt.status,
							...(attempt.errorMessage !== undefined && { error_message: attempt.errorMessage }),
						})),
					}),
					...(task.resumeState !== undefined && { resume_state: task.resumeState }),
					...(task.progress.length > 0 && { progress: task.progress }),
					...(task.finalResponse !== undefined && { final_response: task.finalResponse }),
					...(task.lastError !== undefined && { error_message: task.lastError.message }),
					...(task.toolAllowlist !== undefined && { tool_allowlist: task.toolAllowlist }),
					...(task.toolDisallowlist !== undefined && { tool_disallowlist: task.toolDisallowlist }),
				},
			};
		},
	};
}
