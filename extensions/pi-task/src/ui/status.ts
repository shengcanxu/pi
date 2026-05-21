import { isTerminalTaskStatus } from "../runtime/task-state.js";
import type { TaskRecord } from "../runtime/types.js";

export type StatusUiContext = {
	hasUI: boolean;
	sessionManager?: {
		getSessionId: () => string;
	};
	ui: {
		setStatus: (key: string, value: string | undefined) => void;
		setWidget: (key: string, value: string[] | undefined, options?: { placement: "belowEditor" }) => void;
		theme: {
			fg: (color: "accent", value: string) => string;
		};
	};
};

type TaskListSource = {
	list: () => TaskRecord[];
	listForScope?: (scope: { sessionId?: string; taskId?: string; all?: boolean }) => TaskRecord[];
};

type TaskScopeOptions = {
	sessionId?: string;
};

function taskBelongsToSession(task: TaskRecord, sessionId: string | undefined): boolean {
	if (sessionId === undefined) return true;
	return task.parentSessionId === sessionId || task.rootSessionId === sessionId;
}

function scopedTasks(tasks: readonly TaskRecord[], options: TaskScopeOptions = {}): TaskRecord[] {
	return tasks.filter((task) => taskBelongsToSession(task, options.sessionId));
}

function listScoped(source: TaskListSource, options: TaskScopeOptions = {}): TaskRecord[] {
	return (
		source.listForScope?.(options.sessionId === undefined ? {} : { sessionId: options.sessionId }) ??
		scopedTasks(source.list(), options)
	);
}

function latestProgress(task: TaskRecord): string | undefined {
	return task.progress.at(-1);
}

function formatModelAttempts(task: TaskRecord): string | undefined {
	if (task.modelAttempts.length === 0) return undefined;
	return task.modelAttempts.map((attempt) => `${attempt.model}:${attempt.status}`).join(",");
}

function formatProcessExit(task: TaskRecord): string | undefined {
	if (task.processExit === undefined) return undefined;
	const parts: string[] = [];
	if (task.processExit.code !== undefined) parts.push(`code:${task.processExit.code}`);
	if (task.processExit.signal !== undefined) parts.push(`signal:${task.processExit.signal}`);
	return parts.length === 0 ? undefined : parts.join(",");
}

function shortTask(task: TaskRecord, options: { includeProgress?: boolean } = {}): string {
	const parts = [
		task.taskId,
		task.agentType,
		task.status,
		`mode:${task.executionMode}`,
		`parent:${task.parentSessionId}`,
		`root:${task.rootSessionId}`,
	];
	if (task.agentMode !== undefined) parts.push(`agentMode:${task.agentMode}`);
	if (task.model !== undefined) parts.push(`model:${task.model}`);
	const attempts = formatModelAttempts(task);
	if (attempts !== undefined) parts.push(`attempts:${attempts}`);
	if (task.pid !== undefined) parts.push(`pid:${task.pid}`);
	if (task.childSessionId !== undefined) parts.push(`child:${task.childSessionId}`);
	const processExit = formatProcessExit(task);
	if (processExit !== undefined) parts.push(`exit:${processExit}`);
	if (task.resumeState !== undefined && task.resumeState !== "fresh") parts.push(`resume:${task.resumeState}`);
	if (task.lastError !== undefined) parts.push(`error:${task.lastError.message}`);
	if (options.includeProgress) {
		const progress = latestProgress(task);
		if (progress !== undefined) parts.push(`progress:${progress}`);
	}
	if (task.finalResponse !== undefined) parts.push(`final:${task.finalResponse}`);
	return parts.join(" ");
}

export function formatTaskList(tasks: readonly TaskRecord[], options: TaskScopeOptions = {}): string {
	tasks = scopedTasks(tasks, options);
	if (tasks.length === 0) return "No pi-task tasks are known in this session.";
	return tasks.map((task) => shortTask(task, { includeProgress: true })).join("\n");
}

export function formatFooterStatus(manager: TaskListSource, options: TaskScopeOptions = {}): string | undefined {
	const tasks = listScoped(manager, options);
	if (tasks.length === 0) return undefined;
	const running = tasks.filter((task) => task.status === "running" || task.status === "retrying").length;
	const terminal = tasks.filter((task) => isTerminalTaskStatus(task.status)).length;
	const errored = tasks.filter(
		(task) => task.status === "failed" || task.status === "killed" || task.status === "lost",
	).length;
	const pieces = [`tasks:${tasks.length}`];
	if (running > 0) pieces.push(`run:${running}`);
	if (terminal > 0) pieces.push(`done:${terminal}`);
	if (errored > 0) pieces.push(`err:${errored}`);
	const active = tasks.find((task) => !isTerminalTaskStatus(task.status));
	if (active !== undefined) pieces.push("|", shortTask(active));
	return pieces.join(" ");
}

export function syncTaskStatusToUi(manager: TaskListSource, ctx: StatusUiContext): void {
	if (!ctx.hasUI) return;
	const sessionId = ctx.sessionManager?.getSessionId();
	const options = sessionId === undefined ? {} : { sessionId };
	const status = formatFooterStatus(manager, options);
	ctx.ui.setStatus("pi-task", status === undefined ? undefined : ctx.ui.theme.fg("accent", status));
	const active = listScoped(manager, options).filter((task) => !isTerminalTaskStatus(task.status));
	if (active.length === 0) {
		ctx.ui.setWidget("pi-task", undefined);
		return;
	}
	ctx.ui.setWidget(
		"pi-task",
		active.map((task) => shortTask(task, { includeProgress: true })),
		{
			placement: "belowEditor",
		},
	);
}
