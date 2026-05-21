import type { PermissionConfig, Rule, Ruleset } from "../runtime/types.js";

function escapeRegex(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function matchWildcard(pattern: string, value: string): boolean {
	if (pattern === "*") return true;
	const regex = new RegExp(`^${pattern.split("*").map(escapeRegex).join(".*")}$`);
	return regex.test(value);
}

export function evaluate(permission: string, pattern: string, ruleset: Ruleset): Rule {
	for (let index = ruleset.length - 1; index >= 0; index -= 1) {
		const rule = ruleset[index];
		if (rule !== undefined && matchWildcard(rule.permission, permission) && matchWildcard(rule.pattern, pattern)) {
			return rule;
		}
	}
	return { permission, pattern, action: "ask" };
}

export function fromConfig(config: PermissionConfig): Ruleset {
	return Object.entries(config).flatMap(([permission, value]) => {
		if (typeof value === "string") {
			return [{ permission, pattern: "*", action: value }];
		}

		return Object.entries(value).map(([pattern, action]) => ({ permission, pattern, action }));
	});
}

export function mergeRulesets(...rulesets: Ruleset[]): Ruleset {
	return rulesets.flat();
}

export function isSubagentAllowed(agentType: string, ruleset: Ruleset): boolean {
	const specific = evaluate(`task:${agentType}`, "*", ruleset);
	if (specific.action !== "ask") return specific.action === "allow";
	return evaluate("task", agentType, ruleset).action === "allow";
}
