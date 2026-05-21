import type { AgentToolResult, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { loadAllAgents } from "../agents/loader.js";
import type { AgentInfo } from "../agents/schema.js";
import { resolveChildToolSelection } from "../permissions/tool-allowlist.js";
import { getEnvironmentAncestry, getInProcessAncestry } from "../runtime/ancestry.js";
import type { TaskManager } from "../runtime/task-manager.js";
import { decideTaskPolicy } from "../runtime/task-policy.js";
import type { ExecutionMode } from "../runtime/types.js";

export type TaskToolDetails = {
	task_id: string;
	status: string;
	agent_type?: string;
	agent_mode?: string;
	execution_mode?: ExecutionMode;
	model?: string;
	parent_session_id?: string;
	reason?: string;
};

export const TaskToolParams = Type.Object({
	prompt: Type.String(),
	description: Type.Optional(Type.String()),
	subagent_type: Type.Optional(Type.String()),
	background: Type.Optional(Type.Boolean()),
	execution_mode: Type.Optional(Type.Union([Type.Literal("in-process"), Type.Literal("process")])),
});

type CreateTaskToolOptions = {
	loadAgents?: (cwd: string) => Promise<Record<string, AgentInfo>>;
	getActiveTools?: () => string[];
};

type TaskToolContext = {
	cwd: string;
	sessionManager: Pick<ExtensionContext["sessionManager"], "getSessionId">;
};

function getParentSessionId(ctx: TaskToolContext): string {
	return ctx.sessionManager.getSessionId();
}

function getCurrentAncestry(ctx: TaskToolContext) {
	return getInProcessAncestry(getParentSessionId(ctx)) ?? getEnvironmentAncestry();
}

export function createTaskTool(manager: TaskManager, options: CreateTaskToolOptions = {}) {
	const loadAgents = options.loadAgents ?? loadAllAgents;
	const getActiveTools = options.getActiveTools;
	return {
		name: "task",
		label: "Task",
		description:
			"Delegate work to a subagent. Background tasks return a task_id immediately; use task_status for final responses, errors, pids, resume state, and killed/lost process states.",
		promptSnippet: "Delegate foreground or background work to a subagent.",
		promptGuidelines: [
			"Use task for delegated subagent work that benefits from isolated context.",
			"Use task_status to inspect background task final responses, errors, pids, resume state, and killed/lost process states.",
			"Use task_cancel to stop running subagents.",
		],
		parameters: TaskToolParams,
		async execute(
			_toolCallId: string,
			params: {
				prompt: string;
				description?: string;
				subagent_type?: string;
				background?: boolean;
				execution_mode?: ExecutionMode;
			},
			signal: AbortSignal | undefined,
			onUpdate: ((partial: AgentToolResult<TaskToolDetails>) => void) | undefined,
			ctx: TaskToolContext,
		): Promise<AgentToolResult<TaskToolDetails>> {
			const agents: Record<string, AgentInfo> = await loadAgents(ctx.cwd).catch(() => ({}));
			const agentType = params.subagent_type ?? "default";
			const agent = agents[agentType] ?? (agentType === "default" ? agents["default"] : undefined);
			const ancestry = getCurrentAncestry(ctx);
			const parentAgent = ancestry === undefined ? undefined : agents[ancestry.agentType];
			const policy = decideTaskPolicy({
				targetAgentType: agentType,
				...(ancestry !== undefined && { ancestry }),
				...(parentAgent !== undefined && { parentAgent }),
			});
			if (!policy.allowed) {
				return {
					content: [{ type: "text", text: `Task delegation denied: ${policy.reason}` }],
					details: { task_id: "", status: "denied", reason: policy.reason },
				};
			}
			const background = params.background ?? agent?.background ?? false;
			const executionMode = params.execution_mode ?? agent?.executionMode;
			const parentSessionId = getParentSessionId(ctx);
			const rootSessionId = ancestry?.rootSessionId ?? parentSessionId;
			const depth = (ancestry?.depth ?? 0) + 1;
			const toolSelection = resolveChildToolSelection({ agent, childDepth: depth });
			const explicitDisallowedTools = agent?.disallowedTools ?? [];
			const inheritedProcessToolAllowlist =
				executionMode === "process" && toolSelection.kind === "inherit" && toolSelection.disallowedTools.length > 0
					? getActiveTools?.().filter((tool) => !toolSelection.disallowedTools.includes(tool))
					: undefined;
			const started = manager.start({
				prompt: params.prompt,
				agentType,
				...(agent?.mode !== undefined && { agentMode: agent.mode }),
				...(params.description !== undefined && { description: params.description }),
				parentSessionId,
				rootSessionId,
				...(ancestry?.agentType !== undefined && { parentAgentType: ancestry.agentType }),
				depth,
				cwd: ctx.cwd,
				...(executionMode !== undefined && { executionMode }),
				...(agent?.model !== undefined && { model: agent.model }),
				...(agent?.models !== undefined && { models: agent.models }),
				...(toolSelection.kind === "allowlist" && { toolAllowlist: toolSelection.tools }),
				...(inheritedProcessToolAllowlist !== undefined && { toolAllowlist: inheritedProcessToolAllowlist }),
				...(toolSelection.kind === "inherit" &&
					inheritedProcessToolAllowlist === undefined &&
					toolSelection.disallowedTools.length > 0 && { toolDisallowlist: toolSelection.disallowedTools }),
				...(toolSelection.kind === "allowlist" &&
					explicitDisallowedTools.length > 0 && { toolDisallowlist: explicitDisallowedTools }),
				background,
				...(signal !== undefined && { signal }),
			});
			const startedDetails = {
				task_id: started.task.taskId,
				status: started.task.status,
				agent_type: started.task.agentType,
				...(started.task.agentMode !== undefined && { agent_mode: started.task.agentMode }),
				execution_mode: started.task.executionMode,
				...(started.task.model !== undefined && { model: started.task.model }),
				parent_session_id: started.task.parentSessionId,
			} satisfies TaskToolDetails;
			onUpdate?.({
				content: [{ type: "text", text: `task ${started.task.taskId} running` }],
				details: startedDetails,
			});

			if (background) {
				const parts = [
					`Started background task ${started.task.taskId}`,
					`agent:${started.task.agentType}`,
					`mode:${started.task.executionMode}`,
				];
				if (started.task.model !== undefined) parts.push(`model:${started.task.model}`);
				return {
					content: [
						{
							type: "text",
							text: `${parts.join(" ")}. Use task_status to inspect it.`,
						},
					],
					details: startedDetails,
				};
			}

			const completed = started.promise === undefined ? started.task : await started.promise;
			const text = completed.finalResponse ?? completed.lastError?.message ?? `Task ${completed.status}`;
			return {
				content: [{ type: "text", text }],
				details: {
					task_id: completed.taskId,
					status: completed.status,
					agent_type: completed.agentType,
					...(completed.agentMode !== undefined && { agent_mode: completed.agentMode }),
					execution_mode: completed.executionMode,
					...(completed.model !== undefined && { model: completed.model }),
					parent_session_id: completed.parentSessionId,
				},
			};
		},
	};
}
