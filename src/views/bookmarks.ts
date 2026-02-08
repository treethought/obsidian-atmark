import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type AtmospherePlugin from "../main";
import { CardDetailModal } from "../components/cardDetailModal";
import type { ATBookmarkItem, DataSource, SourceFilter } from "../sources/types";
import { SembleSource } from "../sources/semble";
import { BookmarkSource } from "../sources/bookmark";
import { MarginSource } from "../sources/margin";
import { renderLoginMessage } from "components/loginMessage";

export const VIEW_TYPE_ATMOSPHERE_BOOKMARKS = "atmosphere-bookmarks";

type SourceType = "semble" | "bookmark" | "margin";

export class AtmosphereView extends ItemView {
	plugin: AtmospherePlugin;
	activeSource: SourceType = "semble";
	sources: Map<SourceType, { source: DataSource; filters: Map<string, SourceFilter> }> = new Map();

	constructor(leaf: WorkspaceLeaf, plugin: AtmospherePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	initSources() {
		if (this.plugin.settings.did) {
			const repo = this.plugin.settings.did;
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
		return VIEW_TYPE_ATMOSPHERE_BOOKMARKS;
	}

	getDisplayText() {
		return "Atmosphere bookmarks";
	}

	getIcon() {
		return "layers";
	}

	async onOpen() {
		this.initSources();
		await this.render();
	}

	async fetchItems(): Promise<ATBookmarkItem[]> {
		const sourceData = this.sources.get(this.activeSource);
		if (!sourceData) return [];

		const filters = Array.from(sourceData.filters.values());
		return await sourceData.source.fetchItems(filters, this.plugin);
	}

	async render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("atmosphere-view");


		if (!await this.plugin.checkAuth()) {
			renderLoginMessage(container)
			return
		}

		this.renderHeader(container);

		const loading = container.createEl("p", { text: "Loading..." });

		try {
			const items = await this.fetchItems();
			loading.remove();


			if (items.length === 0) {
				container.createEl("p", { text: "No items found." });
				return;
			}

			const grid = container.createEl("div", { cls: "atmosphere-grid" });
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
			container.createEl("p", { text: `Failed to load: ${message}`, cls: "atmosphere-error" });
		}
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createEl("div", { cls: "atmosphere-header" });

		const sourceSelector = header.createEl("div", { cls: "atmosphere-source-selector" });
		const sources: SourceType[] = ["semble", "margin", "bookmark"];

		for (const source of sources) {
			const label = sourceSelector.createEl("label", { cls: "atmosphere-source-option" });

			const radio = label.createEl("input", {
				type: "radio",
				cls: "atmosphere-source-radio",
			});
			radio.name = "atmosphere-source";
			radio.checked = this.activeSource === source;
			radio.addEventListener("change", () => {
				this.activeSource = source;
				void this.render();
			});

			label.createEl("span", {
				text: source.charAt(0).toUpperCase() + source.slice(1),
				cls: "atmosphere-source-text",
			});
		}

		const filtersContainer = container.createEl("div", { cls: "atmosphere-filters" });
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

	private renderItem(container: HTMLElement, item: ATBookmarkItem) {
		const el = container.createEl("div", { cls: "atmosphere-item" });

		el.addEventListener("click", (e) => {
			// Don't open detail if clicking the edit button
			if ((e.target as HTMLElement).closest(".atmosphere-item-edit-btn")) {
				return;
			}
			new CardDetailModal(this.plugin, item, () => {
				void this.render();
			}).open();
		});

		const header = el.createEl("div", { cls: "atmosphere-item-header" });
		const source = item.getSource();
		header.createEl("span", {
			text: source,
			cls: `atmosphere-badge atmosphere-badge-${source}`,
		});

		if (item.canEdit()) {
			const editBtn = header.createEl("button", {
				cls: "atmosphere-item-edit-btn",
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

		const footer = el.createEl("div", { cls: "atmosphere-item-footer" });
		footer.createEl("span", {
			text: new Date(item.getCreatedAt()).toLocaleDateString(),
			cls: "atmosphere-date",
		});

		// Show note indicator for items with attached notes (semble cards)
		const notes = item.getAttachedNotes?.();
		if (notes && notes.length > 0) {
			const noteIndicator = footer.createEl("div", { cls: "atmosphere-note-indicator" });
			const icon = noteIndicator.createEl("span", { cls: "atmosphere-note-icon" });
			setIcon(icon, "message-square");
			noteIndicator.createEl("span", {
				text: `${notes.length} note${notes.length > 1 ? 's' : ''}`,
				cls: "atmosphere-note-count"
			});
		}
	}

	async onClose() { }
}
