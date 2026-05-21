import { describe, expect, it } from "vitest";

import { createTaskRecord, transitionTask } from "../../src/runtime/task-state.js";
import type { TaskRecord } from "../../src/runtime/types.js";
import { formatFooterStatus, formatTaskList, syncTaskStatusToUi } from "../../src/ui/status.js";

function createRunningTask(overrides: Partial<TaskRecord>): TaskRecord {
	const base = createTaskRecord({
		taskId: overrides.taskId ?? "task_current",
		agentType: overrides.agentType ?? "finder",
		prompt: "Do work",
		parentSessionId: overrides.parentSessionId ?? "current",
		rootSessionId: overrides.rootSessionId ?? "current",
		depth: overrides.depth ?? 1,
		executionMode: overrides.executionMode ?? "process",
		...(overrides.model !== undefined && { model: overrides.model }),
		...(overrides.agentMode !== undefined && { agentMode: overrides.agentMode }),
	});
	return {
		...transitionTask(base, {
			status: "running",
			now: 20,
			...(overrides.pid !== undefined && { pid: overrides.pid }),
		}),
		...overrides,
	};
}

describe("task status UI", () => {
	it("#given active tasks from multiple sessions #when formatting footer #then shows only current parent session details", () => {
		const current = createRunningTask({
			taskId: "task_current",
			agentType: "finder",
			model: "openai/gpt-5.2",
			pid: 1234,
			parentSessionId: "current",
			rootSessionId: "current",
			executionMode: "process",
		});
		const other = createRunningTask({
			taskId: "task_other",
			agentType: "writer",
			model: "anthropic/claude",
			parentSessionId: "other",
			rootSessionId: "other",
		});
		const manager = { list: () => [current, other] };

		const footer = formatFooterStatus(manager, { sessionId: "current" });

		expect(footer).toContain("tasks:1");
		expect(footer).toContain("run:1");
		expect(footer).toContain("finder");
		expect(footer).toContain("openai/gpt-5.2");
		expect(footer).toContain("process");
		expect(footer).toContain("parent:current");
		expect(footer).toContain("root:current");
		expect(footer).toContain("pid:1234");
		expect(footer).not.toContain("writer");
	});

	it("#given active background task #when syncing UI #then footer and widget include agent model mode pid and state", () => {
		const current = createRunningTask({
			taskId: "task_current",
			agentType: "finder",
			model: "openai/gpt-5.2",
			pid: 1234,
			parentSessionId: "current",
			rootSessionId: "current",
			executionMode: "process",
			progress: ["reading files"],
		});
		const manager = { list: () => [current] };
		const statuses: Array<{ key: string; value: string | undefined }> = [];
		const widgets: Array<{ key: string; value: string[] | undefined }> = [];

		syncTaskStatusToUi(manager, {
			hasUI: true,
			sessionManager: { getSessionId: () => "current" },
			ui: {
				setStatus: (key, value) => statuses.push({ key, value }),
				setWidget: (key, value) => widgets.push({ key, value }),
				theme: { fg: (_color, value) => value },
			},
		});

		expect(statuses.at(-1)).toEqual({
			key: "pi-task",
			value: "tasks:1 run:1 | task_current finder running mode:process parent:current root:current model:openai/gpt-5.2 pid:1234",
		});
		expect(widgets.at(-1)?.value?.[0]).toBe(
			"task_current finder running mode:process parent:current root:current model:openai/gpt-5.2 pid:1234 progress:reading files",
		);
	});

	it("#given tasks from another parent session #when syncing UI #then clears stale footer and widget", () => {
		const other = createRunningTask({
			taskId: "task_other",
			parentSessionId: "other",
			rootSessionId: "other",
		});
		const manager = { list: () => [other] };
		const statuses: Array<string | undefined> = [];
		const widgets: Array<string[] | undefined> = [];

		syncTaskStatusToUi(manager, {
			hasUI: true,
			sessionManager: { getSessionId: () => "current" },
			ui: {
				setStatus: (_key, value) => statuses.push(value),
				setWidget: (_key, value) => widgets.push(value),
				theme: { fg: (_color, value) => value },
			},
		});

		expect(statuses.at(-1)).toBeUndefined();
		expect(widgets.at(-1)).toBeUndefined();
	});

	it("#given task list #when formatting list #then includes model mode pid child and final/error facts", () => {
		const task = createRunningTask({
			taskId: "task_current",
			agentType: "finder",
			model: "openai/gpt-5.2",
			pid: 1234,
			childSessionId: "child",
			progress: ["working"],
		});

		const text = formatTaskList([task]);

		expect(text).toContain("task_current finder running");
		expect(text).toContain("mode:process");
		expect(text).toContain("parent:current");
		expect(text).toContain("root:current");
		expect(text).toContain("model:openai/gpt-5.2");
		expect(text).toContain("pid:1234");
		expect(text).toContain("child:child");
		expect(text).toContain("progress:working");
	});

	it("#given task with fallback attempts and process exit #when formatting list #then includes attempt and exit facts", () => {
		const task = {
			...createRunningTask({
				taskId: "task_exit",
				agentType: "finder",
				model: "provider/b",
				parentSessionId: "current",
				rootSessionId: "current",
			}),
			status: "killed" as const,
			modelAttempts: [
				{ model: "provider/a", status: "failed" as const, errorMessage: "overloaded" },
				{ model: "provider/b", status: "completed" as const },
			],
			processExit: { signal: "SIGTERM" },
		};

		const text = formatTaskList([task]);

		expect(text).toContain("attempts:provider/a:failed,provider/b:completed");
		expect(text).toContain("exit:signal:SIGTERM");
	});
});
