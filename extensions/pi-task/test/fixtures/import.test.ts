import { describe, expect, it } from "vitest";

import piTaskExtension from "../../src/index.js";

describe("pi-task package baseline", () => {
	it("#given package entry #when imported #then extension factory is callable", () => {
		expect(typeof piTaskExtension).toBe("function");
	});
});
