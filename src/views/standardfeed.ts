import { getSubscriptions, getPublication, getPublicationDocuments } from "lib/standardsite";
import AtmospherePlugin from "main";
import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { Main as Document } from "@atcute/standard-site/types/document";
import { Main as Publication } from "@atcute/standard-site/types/publication";
import { ATRecord } from "lib";
import { parseResourceUri } from "@atcute/lexicons";
import { renderLoginMessage } from "components/loginMessage";

export const VIEW_ATMOSPHERE_STANDARD_FEED = "atmosphere-standard-site-feed";

export class StandardFeedView extends ItemView {
	plugin: AtmospherePlugin;

	constructor(leaf: WorkspaceLeaf, plugin: AtmospherePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_ATMOSPHERE_STANDARD_FEED;
	}

	getDisplayText() {
		return "Feed";
	}

	getIcon() {
		return "rss";
	}

	async onOpen() {
		await this.render();
	}

	async render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("standard-site-view");

		if (!await this.plugin.checkAuth()) {
			renderLoginMessage(container)
			return
		}

		this.renderHeader(container);

		const loading = container.createEl("p", { text: "Loading subscriptions..." });
		const list = container.createEl("div", { cls: "standard-site-list" });

		try {
			const subsResp = await getSubscriptions(this.plugin.client, this.plugin.client.actor!.did);
			if (subsResp.records.length === 0) {
				loading.remove();
				container.createEl("p", { text: "No subscriptions found" });
				return;
			}

			const pubUris = subsResp.records.map(sub => sub.value.publication);
			for (const uri of pubUris) {
				try {
					const pub = await getPublication(this.plugin.client, uri);
					this.renderPublicationCard(list, pub);
				} catch (e) {
					console.warn(`Failed to fetch publication at ${uri}:`, e);
				}
			}

			loading.remove();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("Failed to load feed:", error);
			container.createEl("p", { text: `Failed to load feed: ${message}`, cls: "standard-site-error" });
			loading.remove();
		}
	}

	private renderPublicationCard(container: HTMLElement, pub: ATRecord<Publication>) {
		const card = container.createEl("div", { cls: "standard-site-publication" });

		const header = card.createEl("div", { cls: "standard-site-publication-header" });
		header.createEl("h3", {
			text: pub.value.name,
			cls: "standard-site-publication-name"
		});
		const extLink = header.createEl("span", { cls: "clickable standard-site-publication-external" });
		setIcon(extLink, "external-link");
		extLink.addEventListener("click", (e) => {
			e.stopPropagation();
			window.open(pub.value.url, "_blank");
		});

		const body = card.createEl("div", { cls: "standard-site-publication-body" });

		const handleEl = body.createEl("span", { cls: "standard-site-author-handle", text: "..." });
		const parsed = parseResourceUri(pub.uri);
		if (parsed.ok) {
			this.plugin.client.getActor(parsed.value.repo).then(actor => {
				if (actor?.handle) {
					handleEl.setText(`@${actor.handle}`);
				} else {
					handleEl.setText("");
				}
			}).catch(() => {
				handleEl.setText("");
			});
		}

		const urlLine = body.createEl("div", { cls: "standard-site-publication-url" });
		const link = urlLine.createEl("a", { text: pub.value.url, href: pub.value.url });
		link.setAttr("target", "_blank");

		if (pub.value.description) {
			body.createEl("p", {
				text: pub.value.description,
				cls: "standard-site-publication-description"
			});
		}

		card.addClass("clickable");
		card.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).tagName !== "A") {
				void this.renderPublicationDocuments(pub);
			}
		});
	}

	private async renderPublicationDocuments(pub: ATRecord<Publication>) {
		const container = this.contentEl;
		container.empty();
		container.addClass("standard-site-view");

		const header = container.createEl("div", { cls: "standard-site-header" });
		const backBtn = header.createEl("span", { text: "Back", cls: "clickable standard-site-back" });
		setIcon(backBtn, "arrow-left");
		backBtn.addEventListener("click", () => {
			void this.render();
		});

		const titleGroup = header.createEl("div", { cls: "standard-site-title-group" });
		titleGroup.createEl("h2", { text: pub.value.name });
		const handleEl = titleGroup.createEl("span", { cls: "standard-site-author-handle", text: "..." });

		const parsed = parseResourceUri(pub.uri);
		if (!parsed.ok) {
			container.createEl("p", { text: "Failed to parse publication address." });
			console.error("Failed to parse publication URI:", parsed.error);
			return;
		}

		// Fetch actor handle asynchronously without blocking document load
		this.plugin.client.getActor(parsed.value.repo).then(actor => {
			if (actor?.handle) {
				handleEl.setText(`@${actor.handle}`);
			} else {
				handleEl.setText("");
			}
		}).catch(() => {
			handleEl.setText("");
		});

		const loading = container.createEl("p", { text: "Loading documents..." });

		try {
			const docsResp = await getPublicationDocuments(this.plugin.client, parsed.value.repo, pub.uri);
			loading.remove();

			if (docsResp.records.length === 0) {
				container.createEl("p", { text: "No documents found for this publication." });
				return;
			}

			const list = container.createEl("div", { cls: "standard-site-list" });
			for (const doc of docsResp.records) {
				this.renderDocumentCard(list, doc, pub);
			}
		} catch (error) {
			loading.remove();
			const message = error instanceof Error ? error.message : String(error);
			container.createEl("p", { text: `Failed to load documents: ${message}`, cls: "standard-site-error" });
		}
	}


	private renderDocumentCard(container: HTMLElement, doc: ATRecord<Document>, pub: ATRecord<Publication>) {
		const card = container.createEl("div", { cls: "standard-site-document" });

		const header = card.createEl("div", { cls: "standard-site-document-header" });
		header.createEl("h3", { text: doc.value.title, cls: "standard-site-document-title" });

		let clipIcon = "book-open";
		const isClipped = this.plugin.clipper.existsInClipDir(doc);
		if (isClipped) {
			clipIcon = "book-open-check";
		}
		const clipBtn = header.createEl("span", { cls: "clickable standard-site-document-clip" });
		if (isClipped) {
			clipBtn.addClass("mod-success");
			clipBtn.setAttribute("aria-label", "Already clipped");
		} else {
			clipBtn.setAttribute("aria-label", "Clip document");
		}
		setIcon(clipBtn, clipIcon);
		clipBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			try {
				void this.plugin.clipper.clipDocument(doc, pub);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				new Notice(`Failed to clip document: ${message}`);
				console.error("Failed to clip document:", error);
			}
		})


		if (doc.value.path) {
			const extLink = header.createEl("span", { cls: "clickable standard-site-document-external" });
			setIcon(extLink, "external-link");
			const baseUrl = pub.value.url.replace(/\/+$/, "");
			const path = doc.value.path.startsWith("/") ? doc.value.path : `/${doc.value.path}`;
			extLink.addEventListener("click", (e) => {
				e.stopPropagation();
				window.open(`${baseUrl}${path}`, "_blank");
			});
		}

		const body = card.createEl("div", { cls: "standard-site-document-body" });

		if (doc.value.description) {
			body.createEl("p", { text: doc.value.description, cls: "standard-site-document-description" });
		}

		if (doc.value.tags && doc.value.tags.length > 0) {
			const tags = body.createEl("div", { cls: "standard-site-document-tags" });
			for (const tag of doc.value.tags) {
				tags.createEl("span", { text: tag, cls: "standard-site-document-tag" });
			}
		}

		if (doc.value.publishedAt) {
			const footer = card.createEl("div", { cls: "standard-site-document-footer" });
			const date = new Date(doc.value.publishedAt).toLocaleDateString();
			footer.createEl("span", { text: date, cls: "standard-site-document-date" });
		}
	}

	renderHeader(container: HTMLElement) {
		const header = container.createEl("div", { cls: "standard-site-header" });
		header.createEl("h2", { text: "Subscriptions" });
	}
}
