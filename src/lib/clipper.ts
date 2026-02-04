import { ATRecord } from "lib";
import { Main as Document } from "@atcute/standard-site/types/document";
import { Main as Publication } from "@atcute/standard-site/types/publication";
import { parseResourceUri } from "@atcute/lexicons";
import { Notice } from "obsidian";
import ATmarkPlugin from "main";
import { leafletContentToMarkdown } from "./markdown/leaflet";
import { pcktContentToMarkdown } from "./markdown/pckt";


export class Clipper {
	plugin: ATmarkPlugin;

	constructor(plugin: any) {
		this.plugin = plugin;
	}

	safeFilePath(title: string, clipDir: string) {
		const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);
		return `${clipDir}/${safeTitle}.md`;
	}

	existsInClipDir(doc: ATRecord<Document>) {
		const vault = this.plugin.app.vault;
		const clipDir = this.plugin.settings.clipDir


		const filePath = this.safeFilePath(doc.value.title, clipDir);
		const file = vault.getAbstractFileByPath(filePath);
		return file !== null;
	}

	async clipDocument(doc: ATRecord<Document>, pub: ATRecord<Publication>) {
		const vault = this.plugin.app.vault;
		const clipDir = this.plugin.settings.clipDir

		const parsed = parseResourceUri(pub.uri);
		if (!parsed.ok) {
			throw new Error(`Invalid publication URI: ${pub.uri}`);
		}
		if (!vault.getAbstractFileByPath(clipDir)) {
			await vault.createFolder(clipDir);
		}
		const filePath = this.safeFilePath(doc.value.title, clipDir);

		// Build markdown content
		let content = `# ${doc.value.title}\n\n`;

		if (doc.value.description) {
			content += `> ${doc.value.description}\n\n`;
		}

		content += `---\n\n`;

		let bodyContent = "";
		if (doc.value.content) {
			const contentType = (doc.value.content as any).$type;
			if (contentType === "pub.leaflet.content") {
				bodyContent = leafletContentToMarkdown(doc.value.content as any);
			} else if (contentType === "blog.pckt.content") {
				bodyContent = pcktContentToMarkdown(doc.value.content as any);
			}
		}

		if (!bodyContent && doc.value.textContent) {
			bodyContent = doc.value.textContent;
		}

		content += bodyContent;

		// Add metadata footer
		content += `\n\n---\n\n`;
		const baseUrl = pub.value.url.replace(/\/+$/, "");
		if (doc.value.path) {
			const path = doc.value.path.startsWith("/") ? doc.value.path : `/${doc.value.path}`;
			const fullUrl = `${baseUrl}${path}`;
			content += `**Source:** [${fullUrl}](${fullUrl})\n`;
		}
		content += `**Publication:** ${pub.value.title}\n`;
		if (doc.value.publishedAt) {
			content += `**Published:** ${new Date(doc.value.publishedAt).toLocaleDateString()}\n`;
		}

		const file = await vault.create(filePath, content);

		// Open the file
		const leaf = this.plugin.app.workspace.getLeaf(false);
		await leaf.openFile(file);

		new Notice(`Clipped document to ${filePath}`);
	}
}

