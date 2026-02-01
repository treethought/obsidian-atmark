import { Notice, TFile } from "obsidian";
import type ATmarkPlugin from "../main";
import { createDocument, markdownToLeafletContent, stripMarkdown } from "../lib";
import { SelectPublicationModal } from "../components/selectPublicationModal";
import { type ResourceUri } from "@atcute/lexicons";
import { SiteStandardDocument } from "lexicons";
import { updateDocument } from "lib/standardsite";

export async function publishFileAsDocument(plugin: ATmarkPlugin) {
	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		new Notice("No active file to publish.");
		return;
	}

	await plugin.initClient();
	if (!plugin.client) {
		new Notice("Not logged in. Check your credentials in settings.");
		return;
	}

	let { record, docUri } = await buildDocumentRecord(plugin, file);

	try {
		let newUri = await createOrUpdateDocument(plugin, record, docUri);
		console.log("Document published with URI:", newUri);

		updateFrontMatter(plugin, file, newUri as ResourceUri, record);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Error publishing document: ${message}`);
		console.error("Publish document error:", error);
	}
}

async function updateFrontMatter(plugin: ATmarkPlugin, file: TFile, docUri: ResourceUri, record: SiteStandardDocument.Main) {
	plugin.app.fileManager.processFrontMatter(file, (fm) => {
		fm["atDocument"] = docUri;
		fm["atPublication"] = record.site;
		fm["publishedAt"] = record.publishedAt;
		fm["updatedAt"] = new Date().toISOString();
		fm["title"] = record.title;
		if (record.description) {
			fm["description"] = record.description;
		}
		if (record.path) {
			fm["path"] = record.path;
		}
		if (record.tags) {
			fm["tags"] = record.tags;
		}
	});

}
async function buildDocumentRecord(plugin: ATmarkPlugin, file: TFile): Promise<{ record: SiteStandardDocument.Main; docUri?: ResourceUri }> {
	const full = await plugin.app.vault.read(file);

	let fm: { [key: string]: any } | null = null;
	await plugin.app.fileManager.processFrontMatter(file, (fmm) => {
		fm = fmm;
	});
	let content = full.replace(/---\n[\s\S]*?\n---\n/, '').trim();


	let docUri: ResourceUri | undefined;
	let pubUri: ResourceUri | undefined;
	let description: string | undefined;
	let title: string | undefined;
	let path: string | undefined;
	let tags: string[] | undefined;
	let publishedAt: string | undefined;
	if (fm) { // TODO settings for property name
		pubUri = fm["atPublication"]
		docUri = fm["atDocument"] as ResourceUri
		description = fm["description"]
		if (fm["title"]) {
			title = fm["title"]
		}
		if (fm["path"]) {
			path = fm["path"]
		}
		// TODO: enable this in setting
		if (fm["tags"] && Array.isArray(fm["tags"])) {
			tags = fm["tags"]
		}
		if (fm["publishedAt"]) {
			publishedAt = fm["publishedAt"]
		} else {
			publishedAt = new Date().toISOString();
		}
	}

	if (!title) {
		title = file.basename;
	}

	if (!pubUri) {
		new SelectPublicationModal(plugin, async (selectedUri) => {
			pubUri = selectedUri as ResourceUri;
		}).open();
	}
	if (!pubUri) {
		new Notice("Publication not selected.");
		throw new Error("Publication not selected.");
	}


	// TODO: determine which lexicon to use for rich content
	let textContent = stripMarkdown(content);
	let richContent = markdownToLeafletContent(content)


	let record: SiteStandardDocument.Main = {
		$type: "site.standard.document",
		title: title,
		site: pubUri,
		publishedAt: publishedAt ?? new Date().toISOString(),
		description: description,
		path: path,
		tags: tags,
		textContent,
		content: richContent as any,
	};
	return { record, docUri }
};

async function createOrUpdateDocument(
	plugin: ATmarkPlugin,
	doc: SiteStandardDocument.Main,
	existingUri?: ResourceUri,
) {

	try {
		if (!plugin.client) {
			throw new Error("Client not initialized");
		}
		let response;
		if (existingUri) {
			console.log("Updating existing document:", existingUri);
			response = await updateDocument(
				plugin.client,
				plugin.settings.identifier,
				existingUri,
				doc
			);
		} else {
			console.log("Creating new document");
			response = await createDocument(
				plugin.client,
				plugin.settings.identifier,
				doc,
			);
		}

		if (!response.ok) {
			new Notice(`Failed to publish: ${response.status}`);
			throw new Error(`Failed to publish: ${response.status}`);
		}

		const documentUri = response.data.uri;
		new Notice(`Published ${doc.title}!`);
		return documentUri;

	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Error publishing: ${message}`);
		console.error("Publish error:", error);
	}
}
