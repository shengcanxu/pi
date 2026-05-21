import { fromConfig, mergeRulesets } from "../permissions/rules.js";
import type { AgentInfo } from "./schema.js";

const registeredAgents = new Map<string, AgentInfo>();

export type CodeAgentInput = Omit<Partial<AgentInfo>, "name" | "native" | "disable"> & {
	name: string;
	prompt: string;
};

export function defineAgent(input: CodeAgentInput): AgentInfo {
	return {
		name: input.name,
		...(input.description !== undefined && { description: input.description }),
		mode: input.mode ?? "all",
		...(input.model !== undefined && { model: input.model }),
		...(input.models !== undefined && { models: input.models }),
		...(input.temperature !== undefined && { temperature: input.temperature }),
		...(input.tools !== undefined && { tools: input.tools }),
		permission: mergeRulesets(fromConfig(input.tools ?? {}), input.permission ?? []),
		...(input.background !== undefined && { background: input.background }),
		...(input.executionMode !== undefined && { executionMode: input.executionMode }),
		...(input.maxTurns !== undefined && { maxTurns: input.maxTurns }),
		...(input.maxDepth !== undefined && { maxDepth: input.maxDepth }),
		allowedSubagents: input.allowedSubagents ?? [],
		disallowedTools: input.disallowedTools ?? [],
		disable: false,
		prompt: input.prompt,
		native: true,
	};
}

export function registerAgent(input: CodeAgentInput | AgentInfo): AgentInfo {
	const agent = "native" in input ? input : defineAgent(input);
	registeredAgents.set(agent.name, agent);
	return agent;
}

export function clearRegisteredAgents(): void {
	registeredAgents.clear();
}

export function loadRegisteredAgents(): Record<string, AgentInfo> {
	return Object.fromEntries(registeredAgents);
}
