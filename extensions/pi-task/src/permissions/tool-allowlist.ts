import type { AgentInfo } from "../agents/schema.js";
import type { Rule } from "../runtime/types.js";
import { fromConfig, mergeRulesets } from "./rules.js";

const TASK_TOOL_FAMILY = ["task", "task_cancel", "task_status"] as const;

export type AgentToolSelection =
	| { kind: "inherit"; disallowedTools: string[] }
	| { kind: "allowlist"; tools: string[] };

export type AgentToolSelectionInput = {
	agent: AgentInfo | undefined;
	childDepth?: number;
};

function uniqueSorted(values: Iterable<string>): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function addTaskToolFamily(tools: Set<string>): void {
	for (const tool of TASK_TOOL_FAMILY) {
		tools.add(tool);
	}
}

function isTaskPermission(rule: Rule): boolean {
	return rule.permission === "task" || rule.permission.startsWith("task:");
}

function isWholeToolDeny(rule: Rule): boolean {
	return rule.action === "deny" && rule.pattern === "*" && !rule.permission.startsWith("task:");
}

export function resolveAgentToolSelection(agent: AgentInfo | undefined, childDepth?: number): AgentToolSelection {
	return childDepth === undefined
		? resolveChildToolSelection({ agent })
		: resolveChildToolSelection({ agent, childDepth });
}

export function resolveChildToolSelection(input: AgentToolSelectionInput): AgentToolSelection {
	const agent = input.agent;
	if (agent === undefined) return { kind: "inherit", disallowedTools: [] };

	const allowed = new Set<string>();
	const denied = new Set(agent.disallowedTools);
	const childDepth = input.childDepth;
	const canUseTaskByDepth = childDepth !== undefined && childDepth < (agent.maxDepth ?? 1);

	const rules = mergeRulesets(fromConfig(agent.tools ?? {}), agent.permission);
	for (const rule of rules) {
		if (rule.action === "allow") {
			if (isTaskPermission(rule)) {
				if (canUseTaskByDepth || rule.permission.startsWith("task:") || rule.pattern !== "*") {
					addTaskToolFamily(allowed);
				}
			} else {
				allowed.add(rule.permission);
			}
			continue;
		}

		if (isWholeToolDeny(rule)) {
			if (rule.permission === "task") {
				for (const tool of TASK_TOOL_FAMILY) {
					denied.add(tool);
				}
			} else {
				denied.add(rule.permission);
			}
		}
	}

	if (agent.allowedSubagents.length > 0 || canUseTaskByDepth) {
		addTaskToolFamily(allowed);
	}

	if (allowed.size === 0) {
		return { kind: "inherit", disallowedTools: uniqueSorted(denied) };
	}

	return {
		kind: "allowlist",
		tools: uniqueSorted([...allowed].filter((tool) => !denied.has(tool))),
	};
}
