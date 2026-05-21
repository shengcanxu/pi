import { describe, expect, it } from "vitest";

import { createModelAttempts, shouldRetryWithFallback } from "../../src/runtime/model-fallback.js";

describe("model fallback", () => {
	it("#given no explicit model #when creating attempts #then inherits parent model label", () => {
		const attempts = createModelAttempts({ parentModel: "anthropic/sonnet" });

		expect(attempts).toEqual([{ model: "anthropic/sonnet", status: "pending" }]);
	});

	it("#given retryable failure and fallback model #when checking retry #then retries next model", () => {
		expect(shouldRetryWithFallback(new Error("rate limit exceeded"), 0, ["a", "b"])).toBe(true);
	});

	it("#given cancellation #when checking retry #then does not fallback", () => {
		expect(shouldRetryWithFallback(new Error("cancelled by user"), 0, ["a", "b"])).toBe(false);
	});
});
