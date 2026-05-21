import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import { getSenpiAgentDir, getTaskStateDir } from "./config/paths.js";
import { CompositeTaskRunner } from "./runtime/composite-runner.js";
import { type BridgeContext, installTaskEventBridge, type PiEventBridgeApi } from "./runtime/event-bridge.js";
import { InProcessRunner } from "./runtime/in-process-runner.js";
import { ProcessTaskRunner } from "./runtime/process-task-runner.js";
import { ResultStore } from "./runtime/result-store.js";
import { TaskEventLogger } from "./runtime/task-logger.js";
import { TaskManager } from "./runtime/task-manager.js";
import { createTaskTool } from "./tools/task.js";
import { createTaskCancelTool } from "./tools/task-cancel.js";
import { createTaskStatusTool } from "./tools/task-status.js";
import { formatTaskList, syncTaskStatusToUi } from "./ui/status.js";

export { clearRegisteredAgents, defineAgent, registerAgent } from "./agents/code-agents.js";

type PiTaskExtensionApi = Pick<ExtensionAPI, "registerTool" | "registerCommand" | "registerShortcut"> &
	Pick<ExtensionAPI, "getActiveTools"> &
	PiEventBridgeApi;

function isCancellableStatus(status: string): boolean {
	return status === "queued" || status === "running" || status === "retrying";
}

function notifyTasks(manager: TaskManager, ctx: ExtensionContext, options: { all?: boolean } = {}): void {
	if (!ctx.hasUI) return;
	syncTaskStatusToUi(manager, ctx);
	const tasks = options.all
		? manager.listForScope({ all: true })
		: manager.listForScope({ sessionId: ctx.sessionManager.getSessionId() });
	ctx.ui.notify(formatTaskList(tasks));
}

async function cancelTaskFromUi(manager: TaskManager, ctx: ExtensionContext): Promise<void> {
	if (!ctx.hasUI) return;
	const sessionId = ctx.sessionManager.getSessionId();
	const tasks = manager.listForScope({ sessionId }).filter((task) => isCancellableStatus(task.status));
	if (tasks.length === 0) {
		ctx.ui.notify("No running pi-task task can be cancelled.", "info");
		return;
	}
	const options = tasks.map((task) => formatTaskList([task]));
	const selected = await ctx.ui.select("Cancel pi-task task", options);
	if (selected === undefined) return;
	const taskId = selected.split(" ")[0];
	if (taskId === undefined) return;
	const ok = await ctx.ui.confirm("Cancel pi-task task", taskId);
	if (!ok) return;
	const cancelled = manager.cancel(taskId, "Cancelled from pi-task TUI.");
	ctx.ui.notify(cancelled === undefined ? `Task ${taskId} was not found.` : `Cancelled ${taskId}.`);
	syncTaskStatusToUi(manager, ctx);
}

export default function piTaskExtension(pi: PiTaskExtensionApi): void {
	const stateDir = getTaskStateDir();
	const agentDir = getSenpiAgentDir();
	let currentUiContext: BridgeContext | undefined;
	const manager = new TaskManager({
		runner: new CompositeTaskRunner({
			inProcess: new InProcessRunner({ agentDir }),
			process: new ProcessTaskRunner(),
		}),
		resultStore: new ResultStore(stateDir),
		logger: new TaskEventLogger(stateDir),
		onTaskChange: () => {
			if (currentUiContext !== undefined) {
				syncTaskStatusToUi(manager, currentUiContext);
			}
		},
	});

	pi.registerTool(createTaskTool(manager, { getActiveTools: () => pi.getActiveTools() }));
	pi.registerTool(createTaskStatusTool(manager));
	pi.registerTool(createTaskCancelTool(manager));

	installTaskEventBridge(pi, {
		manager,
		syncStatus: (ctx) => {
			currentUiContext = ctx;
			syncTaskStatusToUi(manager, ctx);
		},
		getParentModel: () => manager.getParentModel(),
	});

	pi.registerCommand("tasks", {
		description: "Show pi-task subagent task status. Pass --all to include other sessions.",
		handler: async (args, ctx) => {
			notifyTasks(manager, ctx, { all: args.trim() === "--all" || args.trim() === "all" });
		},
	});

	pi.registerCommand("task-kill", {
		description: "Cancel a running pi-task subagent task",
		handler: async (_args, ctx) => {
			await cancelTaskFromUi(manager, ctx);
		},
	});

	pi.registerShortcut(Key.ctrlAlt("t"), {
		description: "Show pi-task status",
		handler: async (ctx) => {
			notifyTasks(manager, ctx);
		},
	});
}
