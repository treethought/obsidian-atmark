import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import { CardDetailModal } from "../components/cardDetailModal";
import type { ATmarkItem, DataSource, SourceFilter } from "../sources/types";
import { SembleSource } from "../sources/semble";
import { BookmarkSource } from "../sources/bookmark";
import { MarginSource } from "../sources/margin";

export const VIEW_TYPE_ATMARK = "atmark-view";

type SourceType = "semble" | "bookmark" | "margin";

export class ATmarkView extends ItemView {
	plugin: ATmarkPlugin;
	activeSource: SourceType = "semble";
	sources: Map<SourceType, { source: DataSource; filters: Map<string, SourceFilter> }> = new Map();

	constructor(leaf: WorkspaceLeaf, plugin: ATmarkPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	initSources() {
		if (this.plugin.settings.identifier) {
			const repo = this.plugin.settings.identifier;
			this.sources.set("semble", {
				source: new SembleSource(this.plugin.client, repo),
				filters: new Map()
			});
			this.sources.set("bookmark", {
				source: new BookmarkSource(this.plugin.client, repo),
				filters: new Map()
			});
			this.sources.set("margin", {
				source: new MarginSource(this.plugin.client, repo),
				filters: new Map()
			});
		}

	}

	getViewType() {
		return VIEW_TYPE_ATMARK;
	}

	getDisplayText() {
		// This is the name of the plugin, which contains the acronym "AT"
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		return "ATmark";
	}

	getIcon() {
		return "layers";
	}

	async onOpen() {
		this.initSources();
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

		this.renderHeader(container);

		const loading = container.createEl("p", { text: "Loading..." });

		try {
			const items = await this.fetchItems();
			loading.remove();


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

		const sourceSelector = header.createEl("div", { cls: "atmark-source-selector" });
		const sources: SourceType[] = ["semble", "margin", "bookmark"];

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

		// Show note indicator for items with attached notes (semble cards)
		const notes = item.getAttachedNotes?.();
		if (notes && notes.length > 0) {
			const noteIndicator = footer.createEl("div", { cls: "atmark-note-indicator" });
			const icon = noteIndicator.createEl("span", { cls: "atmark-note-icon" });
			setIcon(icon, "message-square");
			noteIndicator.createEl("span", {
				text: `${notes.length} note${notes.length > 1 ? 's' : ''}`,
				cls: "atmark-note-count"
			});
		}
	}

	async onClose() { }
}
