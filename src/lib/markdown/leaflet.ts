import type { RootContent, Root } from "mdast";
import { unified } from "unified";
import remarkStringify from "remark-stringify";
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

export function leafletContentToMarkdown(content: PubLeafletContent.Main): string {
	const mdastNodes: RootContent[] = [];

	for (const page of content.pages) {
		if (page.$type !== "pub.leaflet.pages.linearDocument") {
			continue;
		}

		for (const item of page.blocks) {
			const block = item.block;
			const node = leafletBlockToMdast(block);
			if (node) {
				mdastNodes.push(node);
			}
		}
	}

	const root: Root = {
		type: "root",
		children: mdastNodes,
	};

	return unified().use(remarkStringify).stringify(root);
}

function leafletBlockToMdast(block: any): RootContent | null {
	switch (block.$type) {
		case "pub.leaflet.blocks.header":
			return {
				type: "heading",
				depth: block.level,
				children: [{ type: "text", value: block.plaintext }],
			};

		case "pub.leaflet.blocks.text":
			return {
				type: "paragraph",
				children: [{ type: "text", value: block.plaintext }],
			};

		case "pub.leaflet.blocks.unorderedList":
			return {
				type: "list",
				ordered: false,
				spread: false,
				children: block.children.map((item: any) => ({
					type: "listItem",
					spread: false,
					children: [{
						type: "paragraph",
						children: [{ type: "text", value: item.content.plaintext }],
					}],
				})),
			};

		case "pub.leaflet.blocks.code":
			return {
				type: "code",
				lang: block.language || null,
				meta: null,
				value: block.plaintext,
			};

		case "pub.leaflet.blocks.horizontalRule":
			return {
				type: "thematicBreak",
			};

		case "pub.leaflet.blocks.blockquote":
			return {
				type: "blockquote",
				children: [{
					type: "paragraph",
					children: [{ type: "text", value: block.plaintext }],
				}],
			};

		default:
			return null;
	}
}
