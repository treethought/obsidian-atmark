import type { RootContent } from "mdast";
import {
	PubLeafletBlocksUnorderedList,
	PubLeafletContent,
	PubLeafletPagesLinearDocument,
} from "@atcute/leaflet";
import { parseMarkdown, extractText } from "../markdown";

export function markdownToLeafletContent(markdown: string): PubLeafletContent.Main {
	const tree = parseMarkdown(markdown);
	const blocks: PubLeafletPagesLinearDocument.Block[] = [];

	for (const node of tree.children) {
		const block = convertNodeToBlock(node);
		if (block) {
			blocks.push(block);
		}
	}

	return {
		$type: "pub.leaflet.content",
		pages: [{
			$type: "pub.leaflet.pages.linearDocument",
			blocks,
		}],
	};
}

function convertNodeToBlock(node: RootContent): PubLeafletPagesLinearDocument.Block | null {
	switch (node.type) {
		case "heading":
			return {
				block: {
					$type: "pub.leaflet.blocks.header",
					level: node.depth,
					plaintext: extractText(node),
				},
				alignment: "pub.leaflet.pages.linearDocument#textAlignLeft",
			};

		case "paragraph":
			return {
				block: {
					$type: "pub.leaflet.blocks.text",
					plaintext: extractText(node),
					textSize: "default",
				},
				alignment: "pub.leaflet.pages.linearDocument#textAlignLeft",
			};

		case "list": {
			const listItems: PubLeafletBlocksUnorderedList.ListItem[] = node.children.map((item) => ({
				$type: "pub.leaflet.blocks.unorderedList#listItem",
				content: {
					$type: "pub.leaflet.blocks.text",
					plaintext: extractText(item),
					textSize: "default",
				},
			}));

			return {
				block: {
					$type: "pub.leaflet.blocks.unorderedList",
					children: listItems,
				},
				alignment: "pub.leaflet.pages.linearDocument#textAlignLeft",
			};
		}

		case "code":
			return {
				block: {
					$type: "pub.leaflet.blocks.code",
					plaintext: node.value,
					language: node.lang || undefined,
				},
				alignment: "pub.leaflet.pages.linearDocument#textAlignLeft",
			};

		case "thematicBreak":
			return {
				block: {
					$type: "pub.leaflet.blocks.horizontalRule",
				},
				alignment: "pub.leaflet.pages.linearDocument#textAlignLeft",
			};

		case "blockquote":
			return {
				block: {
					$type: "pub.leaflet.blocks.blockquote",
					plaintext: extractText(node),
				},
				alignment: "pub.leaflet.pages.linearDocument#textAlignLeft",
			};

		default:
			return null;
	}
}
