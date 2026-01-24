import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type MyPlugin from "../main";
import { getCollections } from "../lib";
import type { Main as Collection } from "../lexicons/types/network/cosmik/collection";
import { SembleCardsView, VIEW_TYPE_SEMBLE_CARDS } from "./cards";

export const VIEW_TYPE_SEMBLE_COLLECTIONS = "semble-collections-view";

interface CollectionRecord {
	uri: string;
	value: Collection;
}

export class SembleCollectionsView extends ItemView {
	plugin: MyPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_SEMBLE_COLLECTIONS;
	}

	getDisplayText() {
		return "Semble Collections";
	}

	getIcon() {
		return "layout-grid";
	}

	async onOpen() {
		await this.render();
	}

	async openCollection(uri: string, name: string) {
		const { workspace } = this.app;
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_SEMBLE_CARDS, active: true });

		const view = leaf.view as SembleCardsView;
		view.setCollection(uri, name);

		workspace.revealLeaf(leaf);
	}

	async render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("semble-collections-view");

		container.createEl("h4", { text: "Collections" });

		if (!this.plugin.client) {
			container.createEl("p", { text: "Not connected. Configure credentials in settings." });
			return;
		}

		const repo = this.plugin.settings.identifier;
		if (!repo) {
			container.createEl("p", { text: "No identifier configured in settings." });
			return;
		}

		const loading = container.createEl("p", { text: "Loading..." });

		try {
			const resp = await getCollections(this.plugin.client, repo);
			loading.remove();

			if (!resp.ok) {
				container.createEl("p", { text: `Error: ${resp.data?.error}`, cls: "semble-error" });
				return;
			}

			const records = resp.data.records as unknown as CollectionRecord[];

			if (records.length === 0) {
				container.createEl("p", { text: "No collections found." });
				return;
			}

			const grid = container.createEl("div", { cls: "semble-card-grid" });

			for (const record of records) {
				const col = record.value;
				const card = grid.createEl("div", { cls: "semble-card" });

				card.addEventListener("click", () => {
					this.plugin.openCollection(record.uri, col.name);
				});

				const header = card.createEl("div", { cls: "semble-card-header" });
				header.createEl("span", { text: col.name, cls: "semble-card-title" });

				const accessIcon = header.createEl("span", {
					cls: `semble-access-icon semble-access-${col.accessType.toLowerCase()}`,
					attr: { "aria-label": col.accessType },
				});
				setIcon(accessIcon, col.accessType === "OPEN" ? "globe" : "lock");

				if (col.description) {
					card.createEl("p", { text: col.description, cls: "semble-card-desc" });
				}

				const footer = card.createEl("div", { cls: "semble-card-footer" });
				if (col.createdAt) {
					footer.createEl("span", {
						text: new Date(col.createdAt).toLocaleDateString(),
						cls: "semble-card-date",
					});
				}
				if (col.collaborators?.length) {
					footer.createEl("span", {
						text: `${col.collaborators.length} collaborators`,
						cls: "semble-card-collabs",
					});
				}
			}
		} catch (e) {
			loading.remove();
			container.createEl("p", { text: `Failed to load: ${e}`, cls: "semble-error" });
		}
	}

	async onClose() {}
}
