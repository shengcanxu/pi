import { InProcessRunner } from "./in-process-runner.js";
import { ProcessTaskRunner } from "./process-task-runner.js";
import type { RunnerInput, RunnerResult, TaskRunner } from "./task-manager.js";

export class CompositeTaskRunner implements TaskRunner {
	readonly #inProcess: TaskRunner;
	readonly #process: TaskRunner;

	constructor(options: { inProcess?: TaskRunner; process?: TaskRunner } = {}) {
		this.#inProcess = options.inProcess ?? new InProcessRunner();
		this.#process = options.process ?? new ProcessTaskRunner();
	}

	run(input: RunnerInput): Promise<RunnerResult> {
		return input.task.executionMode === "process" ? this.#process.run(input) : this.#inProcess.run(input);
	}
}
