import type { ModelAttempt } from "./types.js";

export type ModelAttemptInput = {
	parentModel?: string;
	model?: string;
	models?: string[];
};

export function createModelAttempts(input: ModelAttemptInput): ModelAttempt[] {
	const models =
		input.models && input.models.length > 0 ? input.models : [input.model ?? input.parentModel ?? "inherit"];
	return models.map((model) => ({ model, status: "pending" }));
}

export function shouldRetryWithFallback(error: Error, attemptIndex: number, models: string[]): boolean {
	if (attemptIndex >= models.length - 1) return false;
	const message = error.message.toLowerCase();
	if (message.includes("cancel")) return false;
	if (message.includes("permission")) return false;
	if (message.includes("denied")) return false;
	return (
		message.includes("rate limit") ||
		message.includes("timeout") ||
		message.includes("overloaded") ||
		message.includes("provider") ||
		message.includes("network")
	);
}
