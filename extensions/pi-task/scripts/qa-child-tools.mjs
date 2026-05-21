import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { fromConfig } = await jiti.import("../src/permissions/rules.ts");
const { resolveAgentToolSelection } = await jiti.import("../src/permissions/tool-allowlist.ts");
const { InProcessRunner } = await jiti.import("../src/runtime/in-process-runner.ts");
const { createTaskRecord } = await jiti.import("../src/runtime/task-state.ts");

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

const tools = {
	read: "allow",
	task: { writer: "allow" },
	edit: "deny",
};
const agent = {
	name: "finder",
	mode: "subagent",
	tools,
	permission: fromConfig(tools),
	allowedSubagents: [],
	disallowedTools: ["write"],
	disable: false,
	prompt: "Find facts.",
	native: false,
};

const selection = resolveAgentToolSelection(agent);
assert(selection.kind === "allowlist", `Expected allowlist selection, got ${selection.kind}`);
assert(
	JSON.stringify(selection.tools) === JSON.stringify(["read", "task", "task_cancel", "task_status"]),
	`Unexpected tool selection: ${JSON.stringify(selection.tools)}`,
);

let createSessionInput;
const runner = new InProcessRunner({
	loadAgents: async () => ({ finder: agent }),
	createSession: async (input) => {
		createSessionInput = input;
		return {
			sessionId: "qa-child-session",
			state: { messages: [] },
			subscribe: () => () => {},
			prompt: async () => {},
			dispose: () => {},
		};
	},
});

const task = createTaskRecord({
	taskId: "qa_child_tools",
	agentType: "finder",
	prompt: "qa",
	parentSessionId: "parent",
	rootSessionId: "parent",
	depth: 1,
	executionMode: "in-process",
	toolAllowlist: selection.tools,
});

const result = await runner.run({ task });
assert(result.status === "completed", `Expected completed child run, got ${result.status}`);
assert(createSessionInput?.persistSession === false, "Expected in-process child session to be non-persistent");
assert(
	JSON.stringify(createSessionInput?.tools) === JSON.stringify(["read", "task", "task_cancel", "task_status"]),
	`Expected child tools to be passed to createAgentSession, got ${JSON.stringify(createSessionInput?.tools)}`,
);

console.log("child tools ok");
