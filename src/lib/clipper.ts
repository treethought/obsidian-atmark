import { ATRecord, buildDocumentUrl } from "lib";
import { Main as Document } from "@atcute/standard-site/types/document";
import { Main as Publication } from "@atcute/standard-site/types/publication";
import { is, parseResourceUri } from "@atcute/lexicons";
import { Notice, TFile } from "obsidian";
import ATmarkPlugin from "main";
import { leafletContentToMarkdown } from "./markdown/leaflet";
import { pcktContentToMarkdown } from "./markdown/pckt";
import { ResolvedActor } from "@atcute/identity-resolver";
import { PubLeafletContent } from "@atcute/leaflet";
import { BlogPcktContent } from "@atcute/pckt";


export class Clipper {
	plugin: ATmarkPlugin;

	constructor(plugin: ATmarkPlugin) {
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

	async writeFrontmatter(file: TFile, doc: ATRecord<Document>, pub: ATRecord<Publication>) {
		let actor: ResolvedActor | null = null;
		const repoParsed = parseResourceUri(doc.uri);
		if (repoParsed.ok) {
			actor = await this.plugin.client.getActor(repoParsed.value.repo);
		}
		// Add frontmatter using Obsidian's processFrontMatter
		await this.plugin.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm["title"] = doc.value.title;
			if (actor && actor.handle) {
				fm["author"] = actor.handle;
			}
			fm["aturi"] = doc.uri;

			let docUrl = "";

			// pubUrl is at:// record uri or https:// for loose document
			// fetch pub if at:// so we can get the url
			// otherwise just use the url as is
			if (doc.value.site.startsWith("https://")) {
				docUrl = buildDocumentUrl(doc.value.site, doc.uri, doc.value);
			} else {
				docUrl = buildDocumentUrl(pub.value.url, doc.uri, doc.value);

			}
			if (docUrl) {
				fm["url"] = docUrl;
			}
		});
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

		let content = `# ${doc.value.title}\n\n`;

		if (doc.value.description) {
			content += `> ${doc.value.description}\n\n`;
		}

		content += `---\n\n`;

		let bodyContent = "";
		if (doc.value.content) {
			if (is(PubLeafletContent.mainSchema, doc.value.content)) {
				bodyContent = leafletContentToMarkdown(doc.value.content);
			} else if (is(BlogPcktContent.mainSchema, doc.value.content)) {
				bodyContent = pcktContentToMarkdown(doc.value.content);
			}
		}

		if (!bodyContent && doc.value.textContent) {
			bodyContent = doc.value.textContent;
		}

		content += bodyContent;

		const file = await vault.create(filePath, content);
		await this.writeFrontmatter(file, doc, pub);


		const leaf = this.plugin.app.workspace.getLeaf(false);
		await leaf.openFile(file);

		new Notice(`Clipped document to ${filePath}`);
	}
}

