import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { StatusUiContext } from "../ui/status.js";
import type { TaskManager } from "./task-manager.js";

const ENTRY_TYPE = "pi-task.event";
const GUIDANCE =
	"\n\npi-task: Use task for delegated subagent work. Use task_status to inspect background final responses, errors, resume state, pids, and killed/lost process states. Use task_cancel to stop running subagents.";
let reportedAppendEntryFailure = false;

export type BridgeContext = StatusUiContext & Pick<ExtensionContext, "cwd">;
type Handler = (event: Record<string, unknown>, ctx: BridgeContext) => Promise<unknown> | unknown;

export type PiEventBridgeApi = {
	on: (eventName: string, handler: Handler) => void;
	appendEntry?: ExtensionAPI["appendEntry"];
};

type BridgeDeps = {
	manager: Pick<TaskManager, "resume" | "setParentModel">;
	syncStatus: (ctx: BridgeContext) => void;
	getParentModel: () => string | undefined;
};

function isSelectedModel(value: unknown): value is { readonly provider: unknown; readonly id: unknown } {
	return typeof value === "object" && value !== null && "provider" in value && "id" in value;
}

function isMissingSessionFileError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function appendEvent(pi: PiEventBridgeApi, data: Record<string, unknown>): void {
	try {
		pi.appendEntry?.(ENTRY_TYPE, { ...data, timestamp: Date.now() });
	} catch (error) {
		if (!isMissingSessionFileError(error)) {
			throw error;
		}
		if (!reportedAppendEntryFailure) {
			reportedAppendEntryFailure = true;
			console.warn(`[pi-task] skipped session telemetry append: ${describeError(error)}`);
		}
	}
}

export function installTaskEventBridge(pi: PiEventBridgeApi, deps: BridgeDeps): void {
	pi.on("session_start", async (event, ctx) => {
		const reason = typeof event["reason"] === "string" ? event["reason"] : "startup";
		const cwd = typeof ctx.cwd === "string" ? ctx.cwd : process.cwd();
		await deps.manager.resume({ cwd, reason });
		appendEvent(pi, { type: "session_start", reason, cwd });
		deps.syncStatus(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		appendEvent(pi, { type: "session_shutdown" });
		deps.syncStatus(ctx);
	});

	pi.on("agent_start", async () => {
		appendEvent(pi, { type: "agent_start" });
	});

	pi.on("agent_end", async () => {
		appendEvent(pi, { type: "agent_end" });
	});

	pi.on("tool_call", async (event) => {
		appendEvent(pi, { type: "tool_call", toolName: event["toolName"], toolCallId: event["toolCallId"] });
	});

	pi.on("tool_result", async (event) => {
		appendEvent(pi, { type: "tool_result", toolName: event["toolName"], toolCallId: event["toolCallId"] });
	});

	pi.on("model_select", async (event) => {
		const model = event["model"];
		const modelLabel = isSelectedModel(model)
			? `${String(model.provider)}/${String(model.id)}`
			: deps.getParentModel();
		deps.manager.setParentModel(modelLabel);
		appendEvent(pi, { type: "model_select", model: modelLabel });
	});

	pi.on("before_agent_start", async (event) => {
		const systemPrompt = typeof event["systemPrompt"] === "string" ? event["systemPrompt"] : "";
		if (systemPrompt.includes("pi-task: Use task")) {
			return { systemPrompt };
		}
		return { systemPrompt: `${systemPrompt}${GUIDANCE}` };
	});
}
