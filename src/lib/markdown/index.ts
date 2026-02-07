import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, RootContent, Heading } from "mdast";

export function parseMarkdown(markdown: string): Root {
	return unified().use(remarkParse).parse(markdown);
}

export function extractText(node: RootContent | Root): string {
	if (node.type === "text") {
		return node.value;
	}

	if (node.type === "inlineCode") {
		return node.value;
	}

	if ("children" in node && Array.isArray(node.children)) {
		return node.children.map(extractText).join("");
	}

	if ("value" in node && typeof node.value === "string") {
		return node.value;
	}

	return "";
}

export function extractFirstH1(markdown: string): string | undefined {
	const tree = parseMarkdown(markdown);
	const first = tree.children.find(
		node => node.type === "heading" && node.depth === 1
	) as Heading | undefined;

	return first ? extractText(first) : undefined;
}

/**
 * Strip markdown formatting to plain text
 * Used for the textContent field in standard.site documents
 */
export function stripMarkdown(markdown: string): string {
	const tree = parseMarkdown(markdown);
	return tree.children.map(extractText).join("\n\n").trim();
}

export function cleanPlaintext(text: string): string {
	return text.trim();
}

export type { Root, RootContent };

export { markdownToPcktContent, pcktContentToMarkdown } from "./pckt";
export { markdownToLeafletContent, leafletContentToMarkdown } from "./leaflet";

