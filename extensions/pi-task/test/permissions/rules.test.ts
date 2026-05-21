import { describe, expect, it } from "vitest";

import { evaluate, fromConfig, isSubagentAllowed } from "../../src/permissions/rules.js";

describe("permission rules", () => {
	it("#given later wildcard rule #when evaluating #then last match wins", () => {
		const rules = fromConfig({ task: "deny", "task:finder": "allow" });

		expect(evaluate("task:finder", "*", rules).action).toBe("allow");
		expect(evaluate("task:writer", "*", rules).action).toBe("ask");
	});

	it("#given task subagent allow list #when checking subagents #then allows only matching subagent", () => {
		const rules = fromConfig({ task: "deny", "task:finder": "allow" });

		expect(isSubagentAllowed("finder", rules)).toBe(true);
		expect(isSubagentAllowed("web-librarian", rules)).toBe(false);
	});
});
