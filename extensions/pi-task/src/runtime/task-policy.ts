import type { AgentInfo } from "../agents/schema.js";
import { evaluate, isSubagentAllowed } from "../permissions/rules.js";
import type { TaskAncestry } from "./ancestry.js";

const DEFAULT_MAX_DEPTH = 1;

export type TaskPolicyDecision =
	| { allowed: true; reason: "top-level" | "depth" | "allowed-subagent" | "permission" }
	| { allowed: false; reason: string };

export function decideTaskPolicy(input: {
	targetAgentType: string;
	ancestry?: TaskAncestry;
	parentAgent?: AgentInfo;
	maxDepth?: number;
}): TaskPolicyDecision {
	const childDepth = (input.ancestry?.depth ?? 0) + 1;
	const parentAgent = input.parentAgent;

	if (parentAgent?.allowedSubagents.includes(input.targetAgentType)) {
		return { allowed: true, reason: "allowed-subagent" };
	}

	if (parentAgent !== undefined) {
		const specific = evaluate(`task:${input.targetAgentType}`, "*", parentAgent.permission);
		if (specific.action === "deny") {
			return { allowed: false, reason: `Parent agent ${parentAgent.name} denies task:${input.targetAgentType}.` };
		}
		if (specific.action === "allow" || isSubagentAllowed(input.targetAgentType, parentAgent.permission)) {
			return { allowed: true, reason: "permission" };
		}
	}

	const maxDepth = parentAgent?.maxDepth ?? input.maxDepth ?? DEFAULT_MAX_DEPTH;
	if (childDepth <= maxDepth) {
		return { allowed: true, reason: input.ancestry === undefined ? "top-level" : "depth" };
	}

	return {
		allowed: false,
		reason: `Task nesting depth ${childDepth} exceeds maxDepth ${maxDepth} for ${input.targetAgentType}.`,
	};
}
