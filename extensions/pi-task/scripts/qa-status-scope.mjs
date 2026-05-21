import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { createTaskRecord, transitionTask } = await jiti.import("../src/runtime/task-state.ts");
const { formatFooterStatus, syncTaskStatusToUi } = await jiti.import("../src/ui/status.ts");

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function runningTask(taskId, parentSessionId, agentType, model, pid) {
	const task = createTaskRecord({
		taskId,
		agentType,
		prompt: "qa",
		parentSessionId,
		rootSessionId: parentSessionId,
		depth: 1,
		executionMode: "process",
		model,
	});
	return transitionTask(task, { status: "running", now: Date.now(), pid });
}

const current = runningTask("task_current", "current-session", "finder", "openai/gpt-5.2", 1234);
const other = runningTask("task_other", "other-session", "writer", "anthropic/claude", 5678);
const manager = { list: () => [current, other] };

const footer = formatFooterStatus(manager, { sessionId: "current-session" });
assert(footer?.includes("tasks:1"), `Expected scoped task count in footer, got: ${footer}`);
assert(footer.includes("finder"), `Expected current agent in footer, got: ${footer}`);
assert(footer.includes("openai/gpt-5.2"), `Expected current model in footer, got: ${footer}`);
assert(footer.includes("parent:current-session"), `Expected parent session in footer, got: ${footer}`);
assert(footer.includes("root:current-session"), `Expected root session in footer, got: ${footer}`);
assert(!footer.includes("writer"), `Footer leaked another session task: ${footer}`);

const statuses = [];
const widgets = [];
syncTaskStatusToUi(manager, {
	hasUI: true,
	sessionManager: { getSessionId: () => "other-session" },
	ui: {
		setStatus: (_key, value) => statuses.push(value),
		setWidget: (_key, value) => widgets.push(value),
		theme: { fg: (_color, value) => value },
	},
});

assert(statuses.at(-1)?.includes("writer"), `Expected other-session status in scoped UI, got: ${statuses.at(-1)}`);
assert(widgets.at(-1)?.[0]?.includes("task_other"), `Expected other-session widget row, got: ${widgets.at(-1)}`);

console.log("status scope ok");
