import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { loadRegisteredAgents } from "./code-agents.js";
import { parseFrontmatter } from "./frontmatter.js";
import { type AgentInfo, validateAgentConfig } from "./schema.js";

type ConfigLocation = {
	dir: string;
};

const AGENT_SUBDIRECTORIES = ["agent", "agents"] as const;

function getConfigLocations(cwd: string, homeDir: string): ConfigLocation[] {
	return [
		{ dir: path.join(homeDir, ".pi", "agent") },
		{ dir: path.join(homeDir, ".senpi", "agent") },
		{ dir: path.join(homeDir, ".senpi", "agents") },
		{ dir: path.join(cwd, ".pi") },
		{ dir: path.join(cwd, ".senpi") },
		{ dir: path.join(cwd, ".senpi", "agents") },
	];
}

async function scanDir(dir: string, files: string[]): Promise<void> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			await scanDir(fullPath, files);
		} else if (entry.name.endsWith(".md")) {
			files.push(fullPath);
		}
	}
}

async function scanMarkdownFiles(baseDir: string): Promise<string[]> {
	const files: string[] = [];
	for (const subdir of AGENT_SUBDIRECTORIES) {
		try {
			await scanDir(path.join(baseDir, subdir), files);
		} catch {
			// Missing config directories are expected.
		}
	}
	return files;
}

export async function loadAgentsFromDirectory(dir: string): Promise<Record<string, AgentInfo>> {
	const agents: Record<string, AgentInfo> = {};
	const files = await scanMarkdownFiles(dir);

	for (const file of files) {
		const name = path.basename(file, ".md");
		const content = await fs.readFile(file, "utf-8");
		const { frontmatter, body } = parseFrontmatter(content);
		const result = validateAgentConfig(name, frontmatter, body);
		if (result.ok && !result.value.disable) {
			agents[name] = result.value;
		}
	}

	return agents;
}

export async function loadAllAgents(cwd: string, homeDir: string = os.homedir()): Promise<Record<string, AgentInfo>> {
	const agents: Record<string, AgentInfo> = {};
	for (const location of getConfigLocations(cwd, homeDir)) {
		Object.assign(agents, await loadAgentsFromDirectory(location.dir));
	}
	Object.assign(agents, loadRegisteredAgents());
	return agents;
}
