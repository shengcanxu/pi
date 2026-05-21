import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import type { TaskManager } from "../runtime/task-manager.js";

export const TaskCancelParams = Type.Object({
	task_id: Type.String(),
	reason: Type.Optional(Type.String()),
});

export function createTaskCancelTool(manager: TaskManager) {
	return {
		name: "task_cancel",
		label: "Task Cancel",
		description: "Cancel a running task while preserving its status for task_status.",
		parameters: TaskCancelParams,
		async execute(
			_toolCallId: string,
			params: { task_id: string; reason?: string },
		): Promise<AgentToolResult<{ task_id: string; status: string }>> {
			const task = manager.cancel(params.task_id, params.reason);
			if (task === undefined) {
				return {
					content: [{ type: "text", text: `Task ${params.task_id} was not found.` }],
					details: { task_id: params.task_id, status: "missing" },
				};
			}
			return {
				content: [{ type: "text", text: `Cancelled ${task.taskId}.` }],
				details: { task_id: task.taskId, status: task.status },
			};
		},
	};
}
