import { Modal } from "obsidian";
import type AtmospherePlugin from "../main";
import { getPublications } from "../lib";
import { SiteStandardPublication } from "@atcute/standard-site";
import type { ResourceUri } from "@atcute/lexicons";

export type PublicationSelection = {
	uri: ResourceUri;
	publication: SiteStandardPublication.Main;
};

export class SelectPublicationModal extends Modal {
	plugin: AtmospherePlugin;
	onSelect: (selection: PublicationSelection) => void;

	constructor(plugin: AtmospherePlugin, onSelect: (selection: PublicationSelection) => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onSelect = onSelect;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmosphere-modal");

		contentEl.createEl("h2", { text: "Select publication" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not logged in", cls: "atmosphere-error" });
			return;
		}

		const loading = contentEl.createEl("p", { text: "Loading publications..." });

		try {
			const response = await getPublications(this.plugin.client, this.plugin.settings.did!);
			loading.remove();

			let pubs = response.records

			if (pubs.length === 0) {
				contentEl.createEl("p", { text: "No publications found. Create one first." });
				return;
			}

			// Create a list of publications
			const listContainer = contentEl.createEl("div", { cls: "atmosphere-collection-list" });

			for (const pub of pubs) {
				const item = listContainer.createEl("div", { cls: "atmosphere-collection-item" });

				const publication = pub.value;

				const info = item.createEl("div", { cls: "atmosphere-collection-item-info" });
				info.createEl("div", { text: publication.name, cls: "atmosphere-collection-item-name" });

				if (publication.description) {
					info.createEl("div", {
						text: publication.description,
						cls: "atmosphere-collection-item-desc"
					});
				}

				info.createEl("div", {
					text: publication.url,
					cls: "atmosphere-collection-item-desc"
				});

				item.addEventListener("click", () => {
					this.onSelect({
						uri: pub.uri,
						publication,
					});
					this.close();
				});
			}

		} catch (error) {
			loading.remove();
			const message = error instanceof Error ? error.message : String(error);
			contentEl.createEl("p", { text: `Error: ${message}`, cls: "atmosphere-error" });
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
