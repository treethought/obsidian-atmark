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
} from "@atcute/pckt";
import { parseMarkdown, extractText } from "../markdown";

type PcktBlock =
	| BlogPcktBlockText.Main
	| BlogPcktBlockHeading.Main
	| BlogPcktBlockCodeBlock.Main
	| BlogPcktBlockBulletList.Main
	| BlogPcktBlockOrderedList.Main
	| BlogPcktBlockHorizontalRule.Main
	| BlogPcktBlockBlockquote.Main;

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

function convertNodeToBlock(node: RootContent): PcktBlock | null {
	switch (node.type) {
		case "heading": {
			const block: BlogPcktBlockHeading.Main = {
				$type: "blog.pckt.block.heading",
				level: node.depth,
				plaintext: extractText(node),
			};
			return block;
		}

		case "paragraph": {
			const block: BlogPcktBlockText.Main = {
				$type: "blog.pckt.block.text",
				plaintext: extractText(node),
			};
			return block;
		}

		case "list": {
			const listItems: BlogPcktBlockListItem.Main[] = node.children.map((item) => ({
				$type: "blog.pckt.block.listItem",
				content: [{
					$type: "blog.pckt.block.text",
					plaintext: extractText(item),
				}],
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
			const block: BlogPcktBlockBlockquote.Main = {
				$type: "blog.pckt.block.blockquote",
				content: [{
					$type: "blog.pckt.block.text",
					plaintext: extractText(node),
				}],
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

function pcktBlockToMdast(block: any): RootContent | null {
	switch (block.$type) {
		case "blog.pckt.block.heading":
			return {
				type: "heading",
				depth: block.level,
				children: [{ type: "text", value: block.plaintext }],
			};

		case "blog.pckt.block.text":
			return {
				type: "paragraph",
				children: [{ type: "text", value: block.plaintext }],
			};

		case "blog.pckt.block.bulletList":
			return {
				type: "list",
				ordered: false,
				spread: false,
				children: block.content.map((item: any) => {
					const text = item.content.map((c: any) => c.plaintext).join(" ");
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
				children: block.content.map((item: any) => {
					const text = item.content.map((c: any) => c.plaintext).join(" ");
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

		case "blog.pckt.block.blockquote":
			const text = block.content.map((c: any) => c.plaintext).join("\n");
			return {
				type: "blockquote",
				children: [{
					type: "paragraph",
					children: [{ type: "text", value: text }],
				}],
			};

		default:
			return null;
	}
}
