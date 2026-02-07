import type { RootContent, Root } from "mdast";
import { unified } from "unified";
import remarkStringify from "remark-stringify";
import {
	BlogPcktBlockListItem,
	BlogPcktBlockText,
	BlogPcktBlockHeading,
	BlogPcktBlockCodeBlock,
	BlogPcktBlockBulletList,
	BlogPcktBlockOrderedList,
	BlogPcktBlockHorizontalRule,
	BlogPcktBlockBlockquote,
	BlogPcktContent,
	BlogPcktRichtextFacet,
} from "@atcute/pckt";
import { parseMarkdown, cleanPlaintext } from "../markdown";

type PcktBlock =
	| BlogPcktBlockText.Main
	| BlogPcktBlockHeading.Main
	| BlogPcktBlockCodeBlock.Main
	| BlogPcktBlockBulletList.Main
	| BlogPcktBlockOrderedList.Main
	| BlogPcktBlockHorizontalRule.Main
	| BlogPcktBlockBlockquote.Main;

type PcktTextBlock = BlogPcktBlockText.Main & { $type: "blog.pckt.block.text" };

export function markdownToPcktContent(markdown: string): BlogPcktContent.Main {
	const tree = parseMarkdown(markdown);
	const items: PcktBlock[] = [];

	for (const node of tree.children) {
		const block = convertNodeToBlock(node);
		if (block) {
			items.push(block);
		}
	}

	return {
		$type: "blog.pckt.content",
		items,
	} as BlogPcktContent.Main;
}

const textEncoder = new TextEncoder();

function byteLength(text: string): number {
	return textEncoder.encode(text).length;
}

function createFacet(byteStart: number, byteEnd: number, features: BlogPcktRichtextFacet.Main["features"]): BlogPcktRichtextFacet.Main {
	return {
		$type: "blog.pckt.richtext.facet",
		index: {
			$type: "blog.pckt.richtext.facet#byteSlice",
			byteStart,
			byteEnd,
		},
		features,
	};
}

function buildTextFromNodes(nodes: RootContent[]): { text: string; facets: BlogPcktRichtextFacet.Main[] } {
	let text = "";
	let byteOffset = 0;
	const facets: BlogPcktRichtextFacet.Main[] = [];

	const appendText = (value: string) => {
		if (!value) {
			return;
		}
		text += value;
		byteOffset += byteLength(value);
	};

	const walk = (node: RootContent) => {
		switch (node.type) {
			case "text":
				appendText(node.value);
				return;
			case "inlineCode": {
				const start = byteOffset;
				appendText(node.value);
				const end = byteOffset;
				if (start < end) {
					facets.push(createFacet(start, end, [{ $type: "blog.pckt.richtext.facet#code" }]));
				}
				return;
			}
			case "strong": {
				const start = byteOffset;
				for (const child of node.children) {
					walk(child);
				}
				const end = byteOffset;
				if (start < end) {
					facets.push(createFacet(start, end, [{ $type: "blog.pckt.richtext.facet#bold" }]));
				}
				return;
			}
			case "emphasis": {
				const start = byteOffset;
				for (const child of node.children) {
					walk(child);
				}
				const end = byteOffset;
				if (start < end) {
					facets.push(createFacet(start, end, [{ $type: "blog.pckt.richtext.facet#italic" }]));
				}
				return;
			}
			case "delete": {
				const start = byteOffset;
				for (const child of node.children) {
					walk(child);
				}
				const end = byteOffset;
				if (start < end) {
					facets.push(createFacet(start, end, [{ $type: "blog.pckt.richtext.facet#strikethrough" }]));
				}
				return;
			}
			case "link": {
				const start = byteOffset;
				for (const child of node.children) {
					walk(child);
				}
				const end = byteOffset;
				if (start < end && node.url) {
					facets.push(createFacet(start, end, [{ $type: "blog.pckt.richtext.facet#link", uri: node.url }]));
				}
				return;
			}
			case "break":
				appendText("\n");
				return;
			default: {
				if ("children" in node && Array.isArray(node.children)) {
					for (const child of node.children) {
						walk(child);
					}
					return;
				}
				if ("value" in node && typeof node.value === "string") {
					appendText(node.value);
				}
				return;
			}
		}
	};

	for (const node of nodes) {
		walk(node);
	}

	return { text, facets };
}

function buildTextBlockFromNode(node: { children?: RootContent[] }): PcktTextBlock {
	const { text, facets } = buildTextFromNodes(node.children ?? []);
	return {
		$type: "blog.pckt.block.text",
		plaintext: text,
		facets: facets.length > 0 ? facets : undefined,
	} as PcktTextBlock;
}

function convertNodeToBlock(node: RootContent): PcktBlock | null {
	switch (node.type) {
		case "heading": {
			const { text, facets } = buildTextFromNodes(node.children);
			const block: BlogPcktBlockHeading.Main = {
				$type: "blog.pckt.block.heading",
				level: node.depth,
				plaintext: text,
				facets: facets.length > 0 ? facets : undefined,
			};
			return block;
		}

		case "paragraph": {
			return buildTextBlockFromNode(node);
		}

		case "list": {
			const listItems: BlogPcktBlockListItem.Main[] = node.children.map((item) => ({
				$type: "blog.pckt.block.listItem",
				content: [buildTextBlockFromNode(item)],
			}));

			if (node.ordered) {
				const block: BlogPcktBlockOrderedList.Main = {
					$type: "blog.pckt.block.orderedList",
					content: listItems,
				};
				return block;
			} else {
				const block: BlogPcktBlockBulletList.Main = {
					$type: "blog.pckt.block.bulletList",
					content: listItems,
				};
				return block;
			}
		}

		case "code": {
			const block: BlogPcktBlockCodeBlock.Main = {
				$type: "blog.pckt.block.codeBlock",
				plaintext: node.value,
				language: node.lang || undefined,
			};
			return block;
		}

		case "thematicBreak": {
			const block: BlogPcktBlockHorizontalRule.Main = {
				$type: "blog.pckt.block.horizontalRule",
			};
			return block;
		}

		case "blockquote": {
			const textBlock = buildTextBlockFromNode(node);
			const block: BlogPcktBlockBlockquote.Main = {
				$type: "blog.pckt.block.blockquote",
				content: [textBlock],
			};
			return block;
		}

		default:
			return null;
	}
}

/**
 * Convert pckt content to markdown string
 */
export function pcktContentToMarkdown(content: BlogPcktContent.Main): string {
	const mdastNodes: RootContent[] = [];

	for (const block of content.items) {
		const node = pcktBlockToMdast(block);
		if (node) {
			mdastNodes.push(node);
		}
	}

	const root: Root = {
		type: "root",
		children: mdastNodes,
	};

	return unified().use(remarkStringify).stringify(root);
}

function pcktBlockToMdast(block: PcktBlock): RootContent | null {
	switch (block.$type) {
		case "blog.pckt.block.heading":
			return {
				type: "heading",
				depth: block.level as 1 | 2 | 3 | 4 | 5 | 6,
				children: [{ type: "text", value: cleanPlaintext(block.plaintext) }],
			};

		case "blog.pckt.block.text":
			return {
				type: "paragraph",
				children: [{ type: "text", value: cleanPlaintext(block.plaintext) }],
			};

		case "blog.pckt.block.bulletList":
			return {
				type: "list",
				ordered: false,
				spread: false,
				children: block.content.map((item: BlogPcktBlockListItem.Main) => {
					const text = item.content
						.map((c) => ('plaintext' in c ? cleanPlaintext(c.plaintext) : ''))
						.join(" ");
					return {
						type: "listItem",
						spread: false,
						children: [{
							type: "paragraph",
							children: [{ type: "text", value: text }],
						}],
					};
				}),
			};

		case "blog.pckt.block.orderedList":
			return {
				type: "list",
				ordered: true,
				spread: false,
				children: block.content.map((item: BlogPcktBlockListItem.Main) => {
					const text = item.content
						.map((c) => ('plaintext' in c ? cleanPlaintext(c.plaintext) : ''))
						.join(" ");
					return {
						type: "listItem",
						spread: false,
						children: [{
							type: "paragraph",
							children: [{ type: "text", value: text }],
						}],
					};
				}),
			};

		case "blog.pckt.block.codeBlock":
			return {
				type: "code",
				lang: block.language || null,
				meta: null,
				value: block.plaintext,
			};

		case "blog.pckt.block.horizontalRule":
			return {
				type: "thematicBreak",
			};

		case "blog.pckt.block.blockquote": {
			const text = block.content
				.map((c: BlogPcktBlockText.Main) => cleanPlaintext(c.plaintext))
				.join("\n");
			return {
				type: "blockquote",
				children: [{
					type: "paragraph",
					children: [{ type: "text", value: text }],
				}],
			};
		}

		default:
			return null;
	}
}
