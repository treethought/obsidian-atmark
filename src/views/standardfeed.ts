import { getSubscribedPublications } from "lib/standardsite";
import ATmarkPlugin from "main";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { SiteStandardPublication } from "@atcute/standard-site";
import { ATRecord } from "lib";

export const VIEW_STANDARD_FEED = "standard-site-feed";

export class StandardFeedView extends ItemView {
	plugin: ATmarkPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: ATmarkPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_STANDARD_FEED;
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

		if (!this.plugin.client) {
			await this.plugin.refreshClient();
			if (!this.plugin.client) {
				container.createEl("p", { text: "Not logged in, check your credentials in settings." });
				return;
			}
		}

		this.renderHeader(container);

		const loading = container.createEl("p", { text: "Loading feed..." });

		try {
			const pubs = await getSubscribedPublications(this.plugin.settings.identifier);
			loading.remove();

			if (pubs.length === 0) {
				container.createEl("p", { text: "No subscriptions found. Subscribe to publications first." });
				return;
			}

			const list = container.createEl("div", { cls: "standard-site-list" });

			for (const pub of pubs) {
				this.renderPublicationCard(list, pub);
			}
		} catch (error) {
			loading.remove();
			const message = error instanceof Error ? error.message : String(error);
			container.createEl("p", { text: `Failed to load feed: ${message}`, cls: "standard-site-error" });
		}
	}

	private renderPublicationCard(container: HTMLElement, pub: ATRecord<SiteStandardPublication.Main>) {
		const card = container.createEl("div", { cls: "standard-site-publication" });

		// Header with name
		const header = card.createEl("div", { cls: "standard-site-publication-header" });
		header.createEl("h3", {
			text: pub.value.name,
			cls: "standard-site-publication-name"
		});

		// Body
		const body = card.createEl("div", { cls: "standard-site-publication-body" });

		// URL
		const urlLine = body.createEl("div", { cls: "standard-site-publication-url" });
		const link = urlLine.createEl("a", { text: pub.value.url, href: pub.value.url });
		link.setAttr("target", "_blank");

		// Description
		if (pub.value.description) {
			body.createEl("p", {
				text: pub.value.description,
				cls: "standard-site-publication-description"
			});
		}

		// Make card clickable
		card.addClass("clickable");
		card.addEventListener("click", (e) => {
			// Don't trigger if clicking the link
			if ((e.target as HTMLElement).tagName !== "A") {
				window.open(pub.value.url, "_blank");
			}
		});
	}

	renderHeader(container: HTMLElement) {
		const header = container.createEl("div", { cls: "standard-site-header" });
		header.createEl("h2", { text: "Subscriptions" });
	}
}
