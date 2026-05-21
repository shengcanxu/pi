import { parse as parseYaml } from "yaml";

export type ParsedFrontmatter = {
	frontmatter: Record<string, unknown>;
	body: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
	if (!content.startsWith("---\n")) {
		return { frontmatter: {}, body: content.trim() };
	}

	const end = content.indexOf("\n---", 4);
	if (end === -1) {
		return { frontmatter: {}, body: content.trim() };
	}

	const rawFrontmatter = content.slice(4, end);
	const bodyStart = content.indexOf("\n", end + 4);
	const body = bodyStart === -1 ? "" : content.slice(bodyStart + 1).trim();
	const parsed: unknown = parseYaml(rawFrontmatter);
	return { frontmatter: isRecord(parsed) ? parsed : {}, body };
}
