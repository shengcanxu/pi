import { describe, expect, it } from "vitest";

import { validateAgentConfig } from "../../src/agents/schema.js";

describe("agent schema", () => {
	it("#given valid task agent frontmatter #when validating #then preserves fallback models and allowed subagents", () => {
		const result = validateAgentConfig(
			"finder",
			{
				description: "Finds source facts",
				mode: "subagent",
				models: ["gpt-5.5", "gpt-5.4"],
				allowedSubagents: ["github-librarian", "web-librarian"],
				background: true,
				executionMode: "process",
			},
			"Find facts only.",
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.models).toEqual(["gpt-5.5", "gpt-5.4"]);
		expect(result.value.allowedSubagents).toEqual(["github-librarian", "web-librarian"]);
		expect(result.value.background).toBe(true);
		expect(result.value.executionMode).toBe("process");
	});

	it("#given malformed models #when validating #then returns an actionable validation error", () => {
		const result = validateAgentConfig("bad", { models: ["gpt-5.5", 7] }, "Bad agent");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.message).toContain("models");
	});
});
