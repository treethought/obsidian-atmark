import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import { renderProfileIcon } from "../components/profileIcon";
import { CardDetailModal } from "../components/cardDetailModal";
import type { ATmarkItem } from "../sources/types";
import { SembleSource } from "../sources/semble";
import { BookmarkSource } from "../sources/bookmark";

export const VIEW_TYPE_ATMARK = "atmark-view";

type SourceType = "semble" | "bookmark";

export class ATmarkView extends ItemView {
	plugin: ATmarkPlugin;
	activeSource: SourceType = "semble";
	sources: Map<SourceType, { source: any; filters: Map<string, any> }> = new Map();

	constructor(leaf: WorkspaceLeaf, plugin: ATmarkPlugin) {
		super(leaf);
		this.plugin = plugin;

		// Initialize sources
		if (this.plugin.client) {
			const repo = this.plugin.settings.identifier;
			this.sources.set("semble", {
				source: new SembleSource(this.plugin.client, repo),
				filters: new Map()
			});
			this.sources.set("bookmark", {
				source: new BookmarkSource(this.plugin.client, repo),
				filters: new Map()
			});
		}
	}

	getViewType() {
		return VIEW_TYPE_ATMARK;
	}

	getDisplayText() {
		return "ATmark";
	}

	getIcon() {
		return "bookmark";
	}

	async onOpen() {
		await this.render();
	}

	async fetchItems(): Promise<ATmarkItem[]> {
		if (!this.plugin.client) return [];

		const sourceData = this.sources.get(this.activeSource);
		if (!sourceData) return [];

		const filters = Array.from(sourceData.filters.values());
		return await sourceData.source.fetchItems(filters, this.plugin);
	}

	async render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("atmark-view");

		if (!this.plugin.client) {
			container.createEl("p", { text: "Not connected." });
			return;
		}

		const loading = container.createEl("p", { text: "Loading..." });

		try {
			const items = await this.fetchItems();
			loading.remove();

			this.renderHeader(container);

			if (items.length === 0) {
				container.createEl("p", { text: "No items found." });
				return;
			}

			const grid = container.createEl("div", { cls: "atmark-grid" });
			for (const item of items) {
				try {
					this.renderItem(grid, item);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(`Failed to render item ${item.getUri()}: ${message}`);
				}
			}
		} catch (err) {
			loading.remove();
			const message = err instanceof Error ? err.message : String(err);
			container.createEl("p", { text: `Failed to load: ${message}`, cls: "atmark-error" });
		}
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createEl("div", { cls: "atmark-header" });
		const nav = header.createEl("div", { cls: "atmark-nav" });

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		nav.createEl("h1", { text: "ATmark", cls: "atmark-title" });

		// Source selector in the center
		const sourceSelector = nav.createEl("div", { cls: "atmark-source-selector" });
		const sources: SourceType[] = ["semble", "bookmark"];

		for (const source of sources) {
			const label = sourceSelector.createEl("label", { cls: "atmark-source-option" });

			const radio = label.createEl("input", {
				type: "radio",
				cls: "atmark-source-radio",
			});
			radio.name = "atmark-source";
			radio.checked = this.activeSource === source;
			radio.addEventListener("change", () => {
				this.activeSource = source;
				void this.render();
			});

			label.createEl("span", {
				text: source.charAt(0).toUpperCase() + source.slice(1),
				cls: "atmark-source-text",
			});
		}

		renderProfileIcon(nav, this.plugin.profile);

		// Let the active source render its filters
		const filtersContainer = container.createEl("div", { cls: "atmark-filters" });
		const sourceData = this.sources.get(this.activeSource);
		if (sourceData) {
			sourceData.source.renderFilterUI(
				filtersContainer,
				sourceData.filters,
				() => void this.render(),
				this.plugin
			);
		}
	}

	private renderItem(container: HTMLElement, item: ATmarkItem) {
		const el = container.createEl("div", { cls: "atmark-item" });

		el.addEventListener("click", (e) => {
			// Don't open detail if clicking the edit button
			if ((e.target as HTMLElement).closest(".atmark-item-edit-btn")) {
				return;
			}
			new CardDetailModal(this.plugin, item, () => {
				void this.render();
			}).open();
		});

		const header = el.createEl("div", { cls: "atmark-item-header" });
		const source = item.getSource();
		header.createEl("span", {
			text: source,
			cls: `atmark-badge atmark-badge-${source}`,
		});

		// Add edit button if item supports it
		if (item.canEdit()) {
			const editBtn = header.createEl("button", {
				cls: "atmark-item-edit-btn",
			});
			setIcon(editBtn, "more-vertical");
			editBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				item.openEditModal(() => {
					void this.render();
				});
			});
		}

		item.render(el);

		const footer = el.createEl("div", { cls: "atmark-item-footer" });
		footer.createEl("span", {
			text: new Date(item.getCreatedAt()).toLocaleDateString(),
			cls: "atmark-date",
		});
	}

	async onClose() { }
}
