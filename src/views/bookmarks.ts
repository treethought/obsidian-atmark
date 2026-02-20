import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type AtmospherePlugin from "../main";
import { CardDetailModal } from "../components/cardDetailModal";
import { CreateCollectionModal } from "../components/createCollectionModal";
import { CreateMarginCollectionModal } from "../components/createMarginCollectionModal";
import { CreateTagModal } from "../components/createTagModal";
import type { ATBookmarkItem, DataSource, SourceFilter } from "../sources/types";
import { SembleSource } from "../sources/semble";
import { BookmarkSource } from "../sources/bookmark";
import { MarginSource } from "../sources/margin";
import { renderLoginMessage } from "components/loginMessage";

export const VIEW_TYPE_ATMOSPHERE_BOOKMARKS = "atmosphere-bookmarks";

type SourceName = "semble" | "bookmark" | "margin";

export class AtmosphereView extends ItemView {
	plugin: AtmospherePlugin;
	activeSources: Set<SourceName> = new Set(["semble"]);
	selectedCollections: Set<string> = new Set();
	selectedTags: Set<string> = new Set();
	sources: Map<SourceName, { source: DataSource }> = new Map();

	constructor(leaf: WorkspaceLeaf, plugin: AtmospherePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	initSources() {
		if (this.plugin.settings.did) {
			const repo = this.plugin.settings.did;
			this.sources.set("semble", { source: new SembleSource(this.plugin.client, repo) });
			this.sources.set("bookmark", { source: new BookmarkSource(this.plugin.client, repo) });
			this.sources.set("margin", { source: new MarginSource(this.plugin.client, repo) });
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
		const allowedUris = await this.getFilteredItemUris();

		const results = await Promise.all(
			Array.from(this.activeSources).map(async (sourceType) => {
				const sourceData = this.sources.get(sourceType);
				if (!sourceData) return [];

				return await sourceData.source.fetchItems(this.plugin, allowedUris, this.selectedTags);
			})
		);

		const items = results.flat().sort((a, b) =>
			new Date(b.getCreatedAt()).getTime() - new Date(a.getCreatedAt()).getTime()
		);

		await this.injectCollections(items);
		return items;
	}

	private async injectCollections(items: ATBookmarkItem[]) {
		const activeSources = Array.from(this.activeSources)
			.map(s => this.sources.get(s)?.source)
			.filter((s): s is DataSource => s !== undefined);

		const [nameResults, assocResults] = await Promise.all([
			Promise.all(activeSources.map(s => s.getAvailableCollections?.() ?? Promise.resolve([]))),
			Promise.all(activeSources.map(s => s.getCollectionAssociations?.() ?? Promise.resolve([]))),
		]);

		const collectionNameMap = new Map<string, string>();
		const collectionSourceMap = new Map<string, string>();
		for (let i = 0; i < activeSources.length; i++) {
			for (const c of nameResults[i]) {
				collectionNameMap.set(c.value, c.label ?? c.value);
				collectionSourceMap.set(c.value, activeSources[i].name);
			}
		}

		const collectionsMap = new Map<string, Array<{ uri: string; name: string; source: string }>>();
		for (const assoc of assocResults.flat()) {
			const name = collectionNameMap.get(assoc.collection);
			if (name) {
				const existing = collectionsMap.get(assoc.record) ?? [];
				existing.push({ uri: assoc.collection, name, source: collectionSourceMap.get(assoc.collection) ?? "" });
				collectionsMap.set(assoc.record, existing);
			}
		}

		for (const item of items) {
			item.setCollections(collectionsMap.get(item.getUri()) ?? []);
		}
	}

	private async getFilteredItemUris(): Promise<Set<string>> {
		if (this.selectedCollections.size === 0) return new Set<string>();

		const allowedUris = new Set<string>();

		for (const [sourceType, sourceData] of this.sources) {
			if (!this.activeSources.has(sourceType)) continue;
			if (!sourceData.source.getCollectionAssociations) continue;

			const associations = await sourceData.source.getCollectionAssociations();
			for (const assoc of associations) {
				if (this.selectedCollections.has(assoc.collection)) {
					allowedUris.add(assoc.record);
				}
			}
		}
		return allowedUris;
	}

	async render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("atmosphere-view");

		if (!await this.plugin.checkAuth()) {
			renderLoginMessage(container);
			return;
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

	private async refresh() {
		this.plugin.client.clearCache();
		await this.render();
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createEl("div", { cls: "atmosphere-header" });

		const topRow = header.createEl("div", { cls: "atmosphere-header-top-row" });

		const sourceSelector = topRow.createEl("div", { cls: "atmosphere-source-selector" });
		const sources: SourceName[] = ["semble", "margin", "bookmark"];

		for (const source of sources) {
			const label = sourceSelector.createEl("label", { cls: "atmosphere-source-option" });

			const checkbox = label.createEl("input", {
				type: "checkbox",
				cls: "atmosphere-source-toggle",
			});
			checkbox.checked = this.activeSources.has(source);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.activeSources.add(source);
				} else {
					this.activeSources.delete(source);
				}
				void this.render();
			});

			label.createEl("span", {
				text: source.charAt(0).toUpperCase() + source.slice(1),
				cls: "atmosphere-source-text",
			});
		}

		const refreshBtn = topRow.createEl("button", {
			cls: "atmosphere-refresh-btn",
			attr: { "aria-label": "Refresh bookmarks" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => {
			refreshBtn.addClass("atmosphere-refresh-btn-spinning");
			void this.refresh();
			refreshBtn.removeClass("atmosphere-refresh-btn-spinning");
		});

		this.renderFilters(container);
	}

	private renderFilters(container: HTMLElement) {
		const filtersEl = container.createEl("div", { cls: "atmosphere-filters" });

		const collectionSources = (["semble", "margin"] as SourceName[]).filter(s => this.activeSources.has(s));
		if (collectionSources.length > 0) {
			this.renderCollectionsFilter(filtersEl, collectionSources);
		}

		const tagSources = (["margin", "bookmark"] as SourceName[]).filter(s => this.activeSources.has(s));
		if (tagSources.length > 0) {
			this.renderTagsFilter(filtersEl, tagSources);
		}
	}

	private async fetchAllCollections(sources: SourceName[]): Promise<SourceFilter[]> {
		const results = await Promise.all(
			sources.map(s => this.sources.get(s)?.source.getAvailableCollections?.() ?? Promise.resolve([]))
		);
		const seen = new Set<string>();
		return results.flat().filter(c => !seen.has(c.value) && Boolean(seen.add(c.value)));
	}

	private async fetchAllTags(sources: SourceName[]): Promise<SourceFilter[]> {
		const results = await Promise.all(
			sources.map(s => this.sources.get(s)?.source.getAvilableTags?.() ?? Promise.resolve([]))
		);
		const seen = new Set<string>();
		return results.flat().filter(t => !seen.has(t.value) && Boolean(seen.add(t.value)));
	}

	private async renderCollectionsFilter(container: HTMLElement, collectionSources: SourceName[]) {
		const section = container.createEl("div", { cls: "atmosphere-filter-section" });

		const titleRow = section.createEl("div", { cls: "atmosphere-filter-title-row" });
		titleRow.createEl("h3", { text: "Collections", cls: "atmosphere-filter-title" });

		if (collectionSources.includes("semble")) {
			const btn = titleRow.createEl("button", {
				cls: "atmosphere-filter-create-btn",
				attr: { "aria-label": "New Semble collection" },
			});
			setIcon(btn, "plus");
			btn.addEventListener("click", () => new CreateCollectionModal(this.plugin, () => void this.refresh()).open());
		}
		if (collectionSources.includes("margin")) {
			const btn = titleRow.createEl("button", {
				cls: "atmosphere-filter-create-btn",
				attr: { "aria-label": "New Margin collection" },
			});
			setIcon(btn, "plus");
			btn.addEventListener("click", () => new CreateMarginCollectionModal(this.plugin, () => void this.refresh()).open());
		}

		const chips = section.createEl("div", { cls: "atmosphere-filter-chips" });

		const allChip = chips.createEl("button", {
			text: "All",
			cls: `atmosphere-chip ${this.selectedCollections.size === 0 ? "atmosphere-chip-active" : ""}`,
		});
		allChip.addEventListener("click", () => {
			this.selectedCollections.clear();
			void this.render();
		});

		const collections = await this.fetchAllCollections(collectionSources);

		for (const collection of collections) {
			const isActive = this.selectedCollections.has(collection.value);
			const chip = chips.createEl("button", {
				text: collection.label ?? collection.value,
				cls: `atmosphere-chip ${isActive ? "atmosphere-chip-active" : ""}`,
			});
			chip.addEventListener("click", () => {
				if (this.selectedCollections.has(collection.value)) {
					this.selectedCollections.delete(collection.value);
				} else {
					this.selectedCollections.add(collection.value);
				}
				void this.render();
			});
		}
	}

	private async renderTagsFilter(container: HTMLElement, tagSources: SourceName[]) {
		const section = container.createEl("div", { cls: "atmosphere-filter-section" });

		const titleRow = section.createEl("div", { cls: "atmosphere-filter-title-row" });
		titleRow.createEl("h3", { text: "Tags", cls: "atmosphere-filter-title" });

		if (tagSources.includes("bookmark")) {
			const btn = titleRow.createEl("button", {
				cls: "atmosphere-filter-create-btn",
				attr: { "aria-label": "New tag" },
			});
			setIcon(btn, "plus");
			btn.addEventListener("click", () => new CreateTagModal(this.plugin, () => void this.refresh()).open());
		}

		const chips = section.createEl("div", { cls: "atmosphere-filter-chips" });

		const allChip = chips.createEl("button", {
			text: "All",
			cls: `atmosphere-chip ${this.selectedTags.size === 0 ? "atmosphere-chip-active" : ""}`,
		});
		allChip.addEventListener("click", () => {
			this.selectedTags.clear();
			void this.render();
		});

		const tags = await this.fetchAllTags(tagSources);

		for (const tag of tags) {
			const isActive = this.selectedTags.has(tag.value);
			const chip = chips.createEl("button", {
				text: tag.label ?? tag.value,
				cls: `atmosphere-chip ${isActive ? "atmosphere-chip-active" : ""}`,
			});
			chip.addEventListener("click", () => {
				if (this.selectedTags.has(tag.value)) {
					this.selectedTags.delete(tag.value);
				} else {
					this.selectedTags.add(tag.value);
				}
				void this.render();
			});
		}
	}

	private renderItem(container: HTMLElement, item: ATBookmarkItem) {
		const el = container.createEl("div", { cls: "atmosphere-item" });

		el.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest(".atmosphere-item-edit-btn")) {
				return;
			}
			new CardDetailModal(this.plugin, item, () => {
				void this.refresh();
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
					void this.refresh();
				});
			});
		}

		const content = el.createEl("div", { cls: "atmosphere-item-content" });

		const tags = item.getTags();
		if (tags.length > 0) {
			const tagsContainer = content.createEl("div", { cls: "atmosphere-item-tags" });
			for (const tag of tags) {
				tagsContainer.createEl("span", { text: tag, cls: "atmosphere-tag" });
			}
		}

		const title = item.getTitle();
		if (title) {
			content.createEl("div", { text: title, cls: "atmosphere-item-title" });
		}

		const imageUrl = item.getImageUrl();
		if (imageUrl) {
			const img = content.createEl("img", { cls: "atmosphere-item-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = item.getDescription();
		if (description) {
			const desc = description.length > 200 ? description.slice(0, 200) + "…" : description;
			content.createEl("p", { text: desc, cls: "atmosphere-item-desc" });
		}

		const siteName = item.getSiteName();
		if (siteName) {
			content.createEl("span", { text: siteName, cls: "atmosphere-item-site" });
		}

		const url = item.getUrl();
		if (url) {
			const link = content.createEl("a", { text: url, href: url, cls: "atmosphere-item-url" });
			link.setAttr("target", "_blank");
		}

		const footer = el.createEl("div", { cls: "atmosphere-item-footer" });
		footer.createEl("span", {
			text: new Date(item.getCreatedAt()).toLocaleDateString(),
			cls: "atmosphere-date",
		});

		const center = footer.createEl("div", { cls: "atmosphere-item-footer-center" });
		const notes = item.getAttachedNotes?.();
		if (notes && notes.length > 0) {
			const noteIndicator = center.createEl("div", { cls: "atmosphere-note-indicator" });
			const icon = noteIndicator.createEl("span", { cls: "atmosphere-note-icon" });
			setIcon(icon, "message-square");
			noteIndicator.createEl("span", {
				text: `${notes.length} note${notes.length > 1 ? 's' : ''}`,
				cls: "atmosphere-note-count",
			});
		}

		const right = footer.createEl("div", { cls: "atmosphere-item-footer-right" });
		const collections = item.getCollections?.();
		if (collections && collections.length > 0) {
			const collectionIndicator = right.createEl("div", { cls: "atmosphere-collection-indicator" });
			const collectionIcon = collectionIndicator.createEl("span", { cls: "atmosphere-collection-indicator-icon" });
			setIcon(collectionIcon, "folder");
			collectionIndicator.createEl("span", {
				text: collections.length === 1 ? collections[0].name : `${collections.length} collections`,
				cls: "atmosphere-collection-indicator-name",
			});
		}
	}

	async onClose() { }
}
