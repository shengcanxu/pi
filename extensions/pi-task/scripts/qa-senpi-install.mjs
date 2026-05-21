import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(os.homedir(), ".senpi", "agent", "extensions", "pi-task");

async function describeExisting() {
	try {
		const stat = await lstat(target);
		if (stat.isSymbolicLink()) {
			return { kind: "symlink", target: await readlink(target) };
		}
		return { kind: "other", target: undefined };
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
		throw error;
	}
}

const existing = await describeExisting();
if (dryRun) {
	console.log(`dry-run ok: ${repoRoot} -> ${target}${existing ? ` replacing ${existing.kind}` : ""}`);
	process.exit(0);
}

if (existing !== undefined) {
	if (!force && !(existing.kind === "symlink" && path.resolve(existing.target ?? "") === repoRoot)) {
		throw new Error(`Install target already exists at ${target}; pass --force to replace a symlink`);
	}
	await rm(target, { recursive: true, force: true });
}

await mkdir(path.dirname(target), { recursive: true });
await symlink(repoRoot, target, process.platform === "win32" ? "junction" : "dir");

console.log(`installed ok: ${target} -> ${repoRoot}`);
