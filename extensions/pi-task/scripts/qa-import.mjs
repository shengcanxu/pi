import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const extension = await jiti.import("../src/index.ts", { default: true });

if (typeof extension !== "function") {
	throw new Error("pi-task default export is not a function");
}

console.log("import ok");
