import { fromConfig } from "../permissions/rules.js";
import type { AgentMode, ExecutionMode, PermissionConfig, Ruleset } from "../runtime/types.js";

export type AgentInfo = {
	name: string;
	description?: string;
	mode: AgentMode;
	model?: string;
	models?: string[];
	temperature?: number;
	tools?: PermissionConfig;
	permission: Ruleset;
	background?: boolean;
	executionMode?: ExecutionMode;
	maxTurns?: number;
	maxDepth?: number;
	allowedSubagents: string[];
	disallowedTools: string[];
	disable: boolean;
	prompt: string;
	native: boolean;
};

export type ValidationResult<TValue> = { ok: true; value: TValue } | { ok: false; error: Error };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(source: Record<string, unknown>, key: string): ValidationResult<string[] | undefined> {
	const value = source[key];
	if (value === undefined) return { ok: true, value: undefined };
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
		return { ok: false, error: new Error(`Invalid agent config: ${key} must be an array of strings`) };
	}
	return { ok: true, value: [...value] };
}

function readMode(value: unknown): AgentMode {
	return value === "primary" || value === "subagent" || value === "all" ? value : "all";
}

function readExecutionMode(value: unknown): ExecutionMode | undefined {
	return value === "in-process" || value === "process" ? value : undefined;
}

function readPermissionConfig(value: unknown): PermissionConfig | undefined {
	if (!isRecord(value)) return undefined;
	const config: PermissionConfig = {};
	for (const [key, entryValue] of Object.entries(value)) {
		if (entryValue === "allow" || entryValue === "deny" || entryValue === "ask") {
			config[key] = entryValue;
			continue;
		}
		if (!isRecord(entryValue)) continue;
		const nested: Record<string, "allow" | "deny" | "ask"> = {};
		for (const [pattern, action] of Object.entries(entryValue)) {
			if (action === "allow" || action === "deny" || action === "ask") {
				nested[pattern] = action;
			}
		}
		config[key] = nested;
	}
	return config;
}

export function validateAgentConfig(name: string, frontmatter: unknown, body: string): ValidationResult<AgentInfo> {
	const source = isRecord(frontmatter) ? frontmatter : {};
	const models = readStringArray(source, "models");
	if (!models.ok) return models;
	const allowedSubagents = readStringArray(source, "allowedSubagents");
	if (!allowedSubagents.ok) return allowedSubagents;
	const disallowedTools = readStringArray(source, "disallowedTools");
	if (!disallowedTools.ok) return disallowedTools;
	const tools = readPermissionConfig(source["tools"]);
	const model = typeof source["model"] === "string" ? source["model"] : undefined;
	const description = typeof source["description"] === "string" ? source["description"] : undefined;
	const temperature = typeof source["temperature"] === "number" ? source["temperature"] : undefined;
	const background = typeof source["background"] === "boolean" ? source["background"] : undefined;
	const maxTurns = typeof source["maxTurns"] === "number" ? source["maxTurns"] : undefined;
	const maxDepth = typeof source["maxDepth"] === "number" ? source["maxDepth"] : undefined;
	const executionMode = readExecutionMode(source["executionMode"]);

	return {
		ok: true,
		value: {
			name,
			...(description !== undefined && { description }),
			mode: readMode(source["mode"]),
			...(model !== undefined && { model }),
			...(models.value !== undefined && { models: models.value }),
			...(temperature !== undefined && { temperature }),
			...(tools !== undefined && { tools }),
			permission: fromConfig(tools ?? {}),
			...(background !== undefined && { background }),
			...(executionMode !== undefined && { executionMode }),
			...(maxTurns !== undefined && { maxTurns }),
			...(maxDepth !== undefined && { maxDepth }),
			allowedSubagents: allowedSubagents.value ?? [],
			disallowedTools: disallowedTools.value ?? [],
			disable: source["disable"] === true,
			prompt: body.trim(),
			native: false,
		},
	};
}
