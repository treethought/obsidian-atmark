/**
 * Markdown to Pckt blocks parser
 * Converts markdown content to blog.pckt.content format
 */

import type { RootContent } from "mdast";
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
