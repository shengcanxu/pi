import { spawn } from "node:child_process";
import type { ProcessExit, TaskStatus } from "./types.js";

export type ProcessRunnerEvent =
	| { type: "started"; pid: number }
	| { type: "heartbeat"; pid: number }
	| { type: "stderr"; text: string };

export type ProcessRunnerInput = {
	taskId: string;
	agentType?: string;
	parentSessionId?: string;
	rootSessionId?: string;
	depth?: number;
	command: string;
	args: string[];
	cwd?: string;
	signal?: AbortSignal;
	onEvent?: (event: ProcessRunnerEvent) => void;
};

export type ProcessRunnerResult = {
	status: Extract<TaskStatus, "completed" | "failed" | "cancelled" | "killed">;
	pid?: number;
	finalResponse?: string;
	errorMessage?: string;
	processExit?: ProcessExit;
};

export class ProcessRunner {
	run(input: ProcessRunnerInput): Promise<ProcessRunnerResult> {
		return new Promise((resolve) => {
			const child = spawn(input.command, input.args, {
				cwd: input.cwd,
				env: {
					...process.env,
					PI_TASK_ID: input.taskId,
					...(input.agentType !== undefined && { PI_TASK_AGENT_TYPE: input.agentType }),
					...(input.parentSessionId !== undefined && { PI_TASK_PARENT_SESSION_ID: input.parentSessionId }),
					...(input.rootSessionId !== undefined && { PI_TASK_ROOT_SESSION_ID: input.rootSessionId }),
					...(input.depth !== undefined && { PI_TASK_DEPTH: String(input.depth) }),
					PI_TASK_PARENT_TASK_ID: input.taskId,
				},
				stdio: ["ignore", "pipe", "pipe"],
				shell: false,
			});
			let stdout = "";
			let stderr = "";
			let aborted = false;
			let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

			const stopHeartbeat = (): void => {
				if (heartbeatTimer !== undefined) {
					clearInterval(heartbeatTimer);
					heartbeatTimer = undefined;
				}
			};

			if (child.pid !== undefined) {
				input.onEvent?.({ type: "started", pid: child.pid });
				input.onEvent?.({ type: "heartbeat", pid: child.pid });
				const pid = child.pid;
				heartbeatTimer = setInterval(() => {
					input.onEvent?.({ type: "heartbeat", pid });
				}, 1_000);
			}

			child.stdout?.on("data", (chunk: Buffer) => {
				stdout += chunk.toString("utf-8");
			});
			child.stderr?.on("data", (chunk: Buffer) => {
				const text = chunk.toString("utf-8");
				stderr += text;
				input.onEvent?.({ type: "stderr", text });
			});
			child.on("error", (error) => {
				stopHeartbeat();
				resolve({
					status: "failed",
					...(child.pid !== undefined && { pid: child.pid }),
					errorMessage: error.message,
				});
			});
			child.on("close", (code, signal) => {
				stopHeartbeat();
				const pid = child.pid;
				if (aborted) {
					resolve({
						status: "cancelled",
						...(pid !== undefined && { pid }),
						...(code !== null || signal !== null
							? { processExit: { ...(code !== null && { code }), ...(signal !== null && { signal }) } }
							: {}),
						errorMessage: "Process task was cancelled.",
					});
					return;
				}
				if (signal !== null) {
					resolve({
						status: "killed",
						...(pid !== undefined && { pid }),
						processExit: { signal },
						errorMessage: `Process exited after signal ${signal}.`,
					});
					return;
				}
				if (code === 0) {
					resolve({
						status: "completed",
						...(pid !== undefined && { pid }),
						processExit: { code: 0 },
						finalResponse: stdout.trim(),
					});
					return;
				}
				resolve({
					status: "failed",
					...(pid !== undefined && { pid }),
					...(code !== null && { processExit: { code } }),
					errorMessage: stderr.trim() || `Process exited with code ${code ?? "unknown"}.`,
				});
			});

			const abort = (): void => {
				aborted = true;
				child.kill("SIGTERM");
			};
			if (input.signal?.aborted) abort();
			input.signal?.addEventListener("abort", abort, { once: true });
		});
	}
}
