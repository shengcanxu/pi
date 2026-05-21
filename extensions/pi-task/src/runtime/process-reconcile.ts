import { transitionTask } from "./task-state.js";
import type { TaskRecord } from "./types.js";

export type ProcessReconcileOptions = {
	now: number;
	heartbeatTimeoutMs: number;
	isPidAlive: (pid: number) => boolean;
};

export function reconcileProcessTask(task: TaskRecord, options: ProcessReconcileOptions): TaskRecord {
	if (task.executionMode !== "process" || task.status !== "running") return task;
	if (task.pid === undefined) {
		return transitionTask(task, {
			status: "lost",
			now: options.now,
			errorCode: "process_pid_missing",
			errorMessage: "Process-mode task cannot be observed because no pid was recorded.",
		});
	}

	const alive = options.isPidAlive(task.pid);
	const heartbeatAge = task.heartbeatAt === undefined ? Number.POSITIVE_INFINITY : options.now - task.heartbeatAt;
	if (alive && heartbeatAge <= options.heartbeatTimeoutMs) {
		return { ...task, resumeState: "reconciled", updatedAt: options.now };
	}

	return transitionTask(task, {
		status: "lost",
		now: options.now,
		errorCode: "process_disappeared",
		errorMessage: `Process ${task.pid} disappeared or stopped heartbeating before pi-task could collect a final exit event.`,
	});
}
