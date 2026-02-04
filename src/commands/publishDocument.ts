import { Notice, TFile } from "obsidian";
import type ATmarkPlugin from "../main";
import { createDocument, putDocument, getPublication, markdownToLeafletContent, stripMarkdown, markdownToPcktContent, buildDocumentUrl } from "../lib";
import { PublicationSelection, SelectPublicationModal } from "../components/selectPublicationModal";
import { parseResourceUri, type ResourceUri, } from "@atcute/lexicons";
import { SiteStandardDocument, SiteStandardPublication } from "@atcute/standard-site";
import { PubLeafletContent } from "@atcute/leaflet";
import { BlogPcktContent } from "@atcute/pckt";

export async function publishFileAsDocument(plugin: ATmarkPlugin) {
	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		new Notice("No active file to publish.");
		return;
	}

	if (!plugin.client.loggedIn) {
		new Notice("Must login to publish document.");
		return;
	}


	try {
		let { record, docUri } = await buildDocumentRecord(plugin, file);
		let newUri = await createOrUpdateDocument(plugin, record, docUri);

		// pubUrl is at:// record uri or https:// for loose document
		// fetch pub if at:// so we can get the url
		// otherwise just use the url as is
		if (record.site.startsWith("https://")) {
			const documentUrl = buildDocumentUrl(record.site, newUri, record);
			await updateFrontMatter(plugin, file, newUri, record, documentUrl);
			return;
		}
		const pub = await getPublication(plugin.client, record.site as ResourceUri);
		const documentUrl = buildDocumentUrl(pub.value.url, newUri, record);

		await updateFrontMatter(plugin, file, newUri, record, documentUrl);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Error publishing document: ${message}`);
		console.error("Publish document error:", error);
	}
}

async function updateFrontMatter(
	plugin: ATmarkPlugin,
	file: TFile,
	docUri: ResourceUri,
	record: SiteStandardDocument.Main,
	documentUrl?: string
) {
	await plugin.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm["atDocument"] = docUri;
		fm["atPublication"] = record.site;
		fm["publishedAt"] = record.publishedAt;
		fm["updatedAt"] = new Date().toISOString();
		fm["title"] = record.title;
		if (documentUrl) {
			fm["url"] = documentUrl;
		}
		if (record.description) {
			fm["description"] = record.description;
		}
		if (record.path) {
			fm["path"] = record.path;
		}
		if (record.tags) {
			fm["tags"] = record.tags;
		}
		if (documentUrl) {
			fm["url"] = documentUrl;
		}
	});
}


async function buildDocumentRecord(plugin: ATmarkPlugin, file: TFile): Promise<{ record: SiteStandardDocument.Main; docUri?: ResourceUri }> {
	const full = await plugin.app.vault.read(file);

	let fm: Record<string, unknown> | null = null;
	await plugin.app.fileManager.processFrontMatter(file, (fmm: Record<string, unknown>) => {
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
	if (fm) {
		pubUri = fm["atPublication"];
		docUri = fm["atDocument"] as ResourceUri;
		description = fm["description"];
		title = fm["title"];
		tags = fm["tags"] && Array.isArray(fm["tags"]) ? fm["tags"] : undefined;
		publishedAt = fm["publishedAt"]; // Preserve existing if updating
	}

	if (!title) {
		title = file.basename;
	}

	let pub: SiteStandardPublication.Main | null = null;
	if (!pubUri) {
		const sel = await selectPublication(plugin);
		pubUri = sel.uri;
		pub = sel.publication;
	} else {
		const pubData = await getPublication(plugin.client, pubUri);
		pub = pubData.value;
	}

	if (!pubUri) {
		throw new Error("Missing publication URI.");
	}

	// TODO: determine which lexicon to use for rich content
	// for now just check url
	let textContent = stripMarkdown(content);

	let richContent: PubLeafletContent.Main | BlogPcktContent.Main | null = null;
	if (pub?.url.contains("leaflet.pub")) {
		richContent = markdownToLeafletContent(content)
	} else if (pub?.url.contains("pckt.blog")) {
		richContent = markdownToPcktContent(content)
	}

	let record = {
		$type: "site.standard.document",
		title: title,
		site: pubUri,
		publishedAt: publishedAt || "",
		description: description,
		path: path,
		tags: tags,
		textContent,
		content: richContent ?? undefined,
	} as SiteStandardDocument.Main;
	return { record, docUri };
};

async function selectPublication(plugin: ATmarkPlugin): Promise<PublicationSelection> {
	return new Promise<PublicationSelection>((resolve, reject) => {
		let selected = false;
		const modal = new SelectPublicationModal(plugin, (selection) => {
			selected = true;
			resolve(selection);
		});

		// Override close to reject if nothing selected
		const originalClose = modal.close.bind(modal);
		modal.close = () => {
			originalClose();
			if (!selected) {
				reject(new Error("Publication not selected"));
			}
		};

		modal.open();
	});
}


async function createOrUpdateDocument(
	plugin: ATmarkPlugin,
	doc: SiteStandardDocument.Main,
	existingUri?: ResourceUri,
) {
	if (!plugin.client) {
		throw new Error("Client not initialized");
	}

	const response = existingUri
		? await putDocument(plugin.client, plugin.settings.identifier, existingUri, doc)
		: await createDocument(plugin.client, plugin.settings.identifier, doc);

	if (!response.ok) {
		throw new Error(`Failed to publish: ${response.status}`);
	}

	new Notice(`Published ${doc.title}!`);
	return response.data.uri;
}
