import { describe, expect, it, vi } from "vitest";

import { type BridgeContext, installTaskEventBridge } from "../../src/runtime/event-bridge.js";

type Handler = (event: Record<string, unknown>, ctx: BridgeContext) => Promise<unknown> | unknown;

function createContext(cwd = "/tmp/project"): BridgeContext {
	return {
		cwd,
		hasUI: false,
		ui: {
			setStatus: () => {},
			setWidget: () => {},
			theme: { fg: (_color, value) => value },
		},
	};
}

describe("pi event bridge", () => {
	it("#given session_start event #when bridge handles it #then resumes manager and appends compact log entry", async () => {
		const handlers = new Map<string, Handler>();
		const resume = vi.fn();
		const appendEntry = vi.fn();
		const pi = {
			on(eventName: string, handler: Handler) {
				handlers.set(eventName, handler);
			},
			appendEntry,
		};

		installTaskEventBridge(pi, {
			manager: { resume, setParentModel: vi.fn() },
			syncStatus: vi.fn(),
			getParentModel: () => "parent/model",
		});

		await handlers.get("session_start")?.({ type: "session_start", reason: "resume" }, createContext());

		expect(resume).toHaveBeenCalledWith({ cwd: "/tmp/project", reason: "resume" });
		expect(appendEntry).toHaveBeenCalledWith("pi-task.event", expect.objectContaining({ type: "session_start" }));
	});

	it("#given host appendEntry throws ENOENT #when bridge handles lifecycle telemetry #then lifecycle side effects still run", async () => {
		const handlers = new Map<string, Handler>();
		const resume = vi.fn();
		const syncStatus = vi.fn();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const appendEntry = vi.fn(() => {
			throw Object.assign(new Error("missing session file"), { code: "ENOENT" });
		});
		const pi = {
			on(eventName: string, handler: Handler) {
				handlers.set(eventName, handler);
			},
			appendEntry,
		};

		installTaskEventBridge(pi, {
			manager: { resume, setParentModel: vi.fn() },
			syncStatus,
			getParentModel: () => "parent/model",
		});

		await expect(
			handlers.get("session_start")?.({ type: "session_start", reason: "resume" }, createContext()),
		).resolves.toBeUndefined();

		expect(resume).toHaveBeenCalledWith({ cwd: "/tmp/project", reason: "resume" });
		expect(appendEntry).toHaveBeenCalledWith("pi-task.event", expect.objectContaining({ type: "session_start" }));
		expect(syncStatus).toHaveBeenCalledWith(expect.objectContaining({ cwd: "/tmp/project" }));
		expect(warn).toHaveBeenCalledWith("[pi-task] skipped session telemetry append: missing session file");
		warn.mockRestore();
	});

	it("#given before_agent_start #when bridge handles it twice #then injects task guidance once", async () => {
		const handlers = new Map<string, Handler>();
		const pi = {
			on(eventName: string, handler: Handler) {
				handlers.set(eventName, handler);
			},
			appendEntry: vi.fn(),
		};

		installTaskEventBridge(pi, {
			manager: { resume: vi.fn(), setParentModel: vi.fn() },
			syncStatus: vi.fn(),
			getParentModel: () => undefined,
		});

		const first = await handlers.get("before_agent_start")?.({ systemPrompt: "Base" }, createContext());
		const firstSystemPrompt =
			typeof first === "object" && first !== null && "systemPrompt" in first ? String(first.systemPrompt) : "";
		const second = await handlers.get("before_agent_start")?.({ systemPrompt: firstSystemPrompt }, createContext());

		expect(JSON.stringify(first)).toContain("task_status");
		expect(JSON.stringify(second).match(/task_status/g)?.length).toBe(1);
	});
});
