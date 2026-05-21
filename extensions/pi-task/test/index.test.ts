import { describe, expect, it } from "vitest";

import piTaskExtension from "../src/index.js";

describe("pi-task extension entrypoint", () => {
	it("#when loaded #then registers tools commands shortcuts and event bridge", () => {
		const tools: string[] = [];
		const commands: string[] = [];
		const shortcuts: string[] = [];
		const handlers = new Set<string>();
		const pi = {
			registerTool(tool: { name: string }) {
				tools.push(tool.name);
			},
			registerCommand(name: string) {
				commands.push(name);
			},
			registerShortcut(shortcut: string) {
				shortcuts.push(shortcut);
			},
			getActiveTools() {
				return ["read", "bash", "edit", "write"];
			},
			on(eventName: string) {
				handlers.add(eventName);
			},
		};

		piTaskExtension(pi);

		expect(tools).toEqual(expect.arrayContaining(["task", "task_status", "task_cancel"]));
		expect(commands).toEqual(expect.arrayContaining(["tasks", "task-kill"]));
		expect(shortcuts.length).toBeGreaterThan(0);
		expect([...handlers]).toEqual(
			expect.arrayContaining(["session_start", "before_agent_start", "tool_call", "tool_result"]),
		);
	});
});
