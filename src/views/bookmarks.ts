import { ItemView, WorkspaceLeaf, setIcon, Menu, SearchComponent } from "obsidian";
import type AtmospherePlugin from "../main";
import { CardDetailModal } from "../components/cardDetailModal";
import { EditItemModal } from "../components/editItemModal";
import { CreateCollectionModal } from "../components/createCollectionModal";
import { CreateTagModal } from "../components/createTagModal";
import type { ATBookmarkItem, DataSource, SourceFilter } from "../sources/types";
import { SembleSource } from "../sources/semble";
import { BookmarkSource } from "../sources/community";
import { MarginSource } from "../sources/margin";
import { renderLoginMessage } from "components/loginMessage";

export const VIEW_TYPE_ATMOSPHERE_BOOKMARKS = "atmosphere-bookmarks";

export class BookmarksView extends ItemView {
	plugin: AtmospherePlugin;
	selectedCollections: Set<string> = new Set();
	selectedTags: Set<string> = new Set();
	sources: Map<string, DataSource> = new Map();
	searchQuery: string = "";
	private cachedItems: ATBookmarkItem[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: AtmospherePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	initSources() {
		this.sources.clear();
		if (this.plugin.settings.did) {
			const { enabledSources } = this.plugin.settings.bookmarks;
			const repo = this.plugin.settings.did;
			if (enabledSources["semble"]) this.sources.set("semble", new SembleSource(this.plugin.client, repo));
			if (enabledSources["bookmark"]) this.sources.set("bookmark", new BookmarkSource(this.plugin.client, repo));
			if (enabledSources["margin"]) this.sources.set("margin", new MarginSource(this.plugin.client, repo));
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

	private get activeDatasources(): DataSource[] {
		return Array.from(this.sources.values());
	}

	async onOpen() {
		this.initSources();
		await this.render();
	}

	async fetchItems(): Promise<ATBookmarkItem[]> {
		const allowedUris = await this.getFilteredItemUris();

		if (this.selectedCollections.size > 0 && allowedUris.size === 0) return [];

		const results = await Promise.all(
			this.activeDatasources.map(async (source) => {
				if (this.selectedTags.size > 0 && !source.getAvilableTags) return [];
				if (this.selectedCollections.size > 0 && !source.getAvailableCollections) return [];
				return source.fetchItems(this.plugin, allowedUris, this.selectedTags);
			})
		);

		const items = results.flat().sort((a, b) =>
			new Date(b.getCreatedAt()).getTime() - new Date(a.getCreatedAt()).getTime()
		);

		await this.injectCollections(items);
		return items;
	}

	private async injectCollections(items: ATBookmarkItem[]) {
		const sources = this.activeDatasources;

		const [allCollections, assocResults] = await Promise.all([
			Promise.all(sources.map(async s => {
				const cols = await (s.getAvailableCollections?.() ?? Promise.resolve([]));
				return cols.map(c => ({ value: c.value, name: c.label ?? c.value, source: s.name }));
			})).then(r => r.flat()),
			Promise.all(sources.map(s => s.getCollectionAssociations?.() ?? Promise.resolve([]))),
		]);

		const collectionMeta = new Map(allCollections.map(c => [c.value, { name: c.name, source: c.source }]));

		const collectionsMap = new Map<string, Array<{ uri: string; name: string; source: string }>>();
		for (const assoc of assocResults.flat()) {
			const meta = collectionMeta.get(assoc.collection);
			if (meta) {
				const existing = collectionsMap.get(assoc.record) ?? [];
				existing.push({ uri: assoc.collection, name: meta.name, source: meta.source });
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
		for (const source of this.activeDatasources) {
			if (!source.getCollectionAssociations) continue;
			for (const assoc of await source.getCollectionAssociations()) {
				if (this.selectedCollections.has(assoc.collection)) {
					allowedUris.add(assoc.record);
				}
			}
		}
		return allowedUris;
	}

	async render() {
		this.initSources();
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
			this.cachedItems = items;
			loading.remove();
			this.renderGrid(items);
		} catch (err) {
			loading.remove();
			const message = err instanceof Error ? err.message : String(err);
			container.createEl("p", { text: `Failed to load: ${message}`, cls: "atmosphere-error" });
		}
	}

	private renderGrid(items: ATBookmarkItem[]) {
		this.contentEl.querySelector(".atmosphere-grid")?.remove();
		this.contentEl.querySelector(".atmosphere-empty")?.remove();

		const query = this.searchQuery.trim().toLowerCase();
		const filtered = query
			? items.filter(item => this.matchesSearch(item, query))
			: items;

		if (filtered.length === 0) {
			this.contentEl.createEl("p", { text: "No items found.", cls: "atmosphere-empty" });
			return;
		}
		const grid = this.contentEl.createEl("div", { cls: "atmosphere-grid" });
		for (const item of filtered) {
			try { void this.renderItem(grid, item); }
			catch (err) { console.error(`Failed to render item ${item.getUri()}:`, err); }
		}
	}

	private matchesSearch(item: ATBookmarkItem, query: string): boolean {
		return (
			item.getTitle()?.toLowerCase().includes(query) ||
			item.getDescription()?.toLowerCase().includes(query) ||
			item.getUrl()?.toLowerCase().includes(query) ||
			item.getSiteName()?.toLowerCase().includes(query) ||
			item.getTags().some(t => t.toLowerCase().includes(query))
		) ?? false;
	}

	private async refresh() {
		this.plugin.client.clearCache();
		await this.render();
	}

	private renderHeader(container: HTMLElement) {
		this.renderFilters(container);
	}

	private renderFilters(container: HTMLElement) {
		const filtersEl = container.createEl("div", { cls: "atmosphere-filters" });
		const toolbarRow = filtersEl.createEl("div", { cls: "atmosphere-filter-toolbar" });

		const collectionSources = (["semble", "margin"]).filter(s => this.sources.has(s));
		if (collectionSources.length > 0) {
			this.renderCollectionsFilterBtn(toolbarRow, collectionSources);
		}

		const tagSources = (["margin", "bookmark"]).filter(s => this.sources.has(s));
		if (tagSources.length > 0) {
			this.renderTagsFilterBtn(toolbarRow, tagSources);
		}

		const searchInput = new SearchComponent(toolbarRow);
		searchInput.setValue(this.searchQuery);
		searchInput.setPlaceholder("Search bookmarks...");
		searchInput.onChange(() => {
			this.searchQuery = searchInput.getValue();
			this.renderGrid(this.cachedItems);
		});

		const refreshBtn = toolbarRow.createEl("button", {
			cls: "atmosphere-refresh-btn",
			attr: { "aria-label": "Refresh bookmarks" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => {
			refreshBtn.addClass("atmosphere-refresh-btn-spinning");
			void this.refresh();
			refreshBtn.removeClass("atmosphere-refresh-btn-spinning");
		});

		if (this.selectedCollections.size > 0 || this.selectedTags.size > 0) {
			const chipsRow = filtersEl.createEl("div", { cls: "atmosphere-active-chips-row" });
			if (this.selectedCollections.size > 0 && collectionSources.length > 0) {
				void this.renderActiveCollectionChips(chipsRow, collectionSources);
			}
			if (this.selectedTags.size > 0 && tagSources.length > 0) {
				void this.renderActiveTagChips(chipsRow, tagSources);
			}
		}
	}

	private renderCollectionsFilterBtn(toolbar: HTMLElement, collectionSources: string[]) {
		const group = toolbar.createEl("div", { cls: "atmosphere-filter-btn-group" });

		const pickerBtn = group.createEl("button", {
			cls: "atmosphere-filter-picker-btn",
			attr: { "aria-label": "Filter collections" },
		});
		setIcon(pickerBtn, "folder");
		pickerBtn.createEl("span", { text: "Collections", cls: "atmosphere-filter-title" });
		pickerBtn.addEventListener("click", (e) => void this.showCollectionsMenu(e, collectionSources));

		const btn = group.createEl("button", {
			cls: "atmosphere-filter-create-btn",
			attr: { "aria-label": "New collection" },
		});
		setIcon(btn, "plus");
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			new CreateCollectionModal(
				this.plugin,
				collectionSources as ("semble" | "margin")[],
				() => void this.refresh()
			).open();
		});
	}

	private renderTagsFilterBtn(toolbar: HTMLElement, tagSources: string[]) {
		const group = toolbar.createEl("div", { cls: "atmosphere-filter-btn-group" });

		const pickerBtn = group.createEl("button", {
			cls: "atmosphere-filter-picker-btn",
			attr: { "aria-label": "Filter tags" },
		});
		setIcon(pickerBtn, "tag");
		pickerBtn.createEl("span", { text: "Tags", cls: "atmosphere-filter-title" });
		pickerBtn.addEventListener("click", (e) => void this.showTagsMenu(e, tagSources));

		if (tagSources.includes("bookmark")) {
			const btn = group.createEl("button", {
				cls: "atmosphere-filter-create-btn",
				attr: { "aria-label": "New tag" },
			});
			setIcon(btn, "plus");
			btn.addEventListener("click", (e) => { e.stopPropagation(); new CreateTagModal(this.plugin, () => void this.refresh()).open(); });
		}
	}

	private async fetchAllCollections(sources: string[]): Promise<(SourceFilter & { source: string })[]> {
		const results = await Promise.all(
			sources.map(async s => {
				const items = await (this.sources.get(s)?.getAvailableCollections?.() ?? Promise.resolve([]));
				return items.map(c => ({ ...c, source: s }));
			})
		);
		const seen = new Set<string>();
		return results.flat().filter(c => !seen.has(c.value) && Boolean(seen.add(c.value)));
	}

	private async fetchAllTags(sources: string[]): Promise<(SourceFilter & { source: string })[]> {
		const results = await Promise.all(
			sources.map(async s => {
				const items = await (this.sources.get(s)?.getAvilableTags?.() ?? Promise.resolve([]));
				return items.map(t => ({ ...t, source: s }));
			})
		);
		const seen = new Set<string>();
		return results.flat().filter(t => !seen.has(t.value) && Boolean(seen.add(t.value)));
	}

	private async renderActiveCollectionChips(chipsRow: HTMLElement, collectionSources: string[]) {
		const collections = await this.fetchAllCollections(collectionSources);
		for (const c of collections) {
			if (!this.selectedCollections.has(c.value)) continue;
			const chip = chipsRow.createEl("span", { cls: "atmosphere-chip atmosphere-chip-active atmosphere-chip-removable" });
			setIcon(chip, sourceIconId(c.source));
			chip.createEl("span", { text: c.label ?? c.value });
			const x = chip.createEl("button", { cls: "atmosphere-chip-remove-btn", attr: { "aria-label": `Remove ${c.label ?? c.value}` } });
			setIcon(x, "x");
			x.addEventListener("click", () => {
				this.selectedCollections.delete(c.value);
				void this.render();
			});
		}
	}

	private async renderActiveTagChips(chipsRow: HTMLElement, tagSources: string[]) {
		const tags = await this.fetchAllTags(tagSources);
		for (const t of tags) {
			if (!this.selectedTags.has(t.value)) continue;
			const chip = chipsRow.createEl("span", { cls: "atmosphere-chip atmosphere-chip-active atmosphere-chip-removable" });
			setIcon(chip, sourceIconId(t.source));
			chip.createEl("span", { text: "#" + (t.label ?? t.value) });
			const x = chip.createEl("button", { cls: "atmosphere-chip-remove-btn", attr: { "aria-label": `Remove ${t.label ?? t.value}` } });
			setIcon(x, "x");
			x.addEventListener("click", () => {
				this.selectedTags.delete(t.value);
				void this.render();
			});
		}
	}

	private async showCollectionsMenu(e: MouseEvent, sources: string[]) {
		e.stopPropagation();
		const collections = (await this.fetchAllCollections(sources))
			.sort((a, b) => (a.label ?? a.value).localeCompare(b.label ?? b.value));
		const menu = new Menu();
		for (const c of collections) {
			menu.addItem(item => item
				.setTitle(c.label ?? c.value)
				.setIcon(sourceIconId(c.source))
				.setChecked(this.selectedCollections.has(c.value))
				.onClick(() => {
					if (this.selectedCollections.has(c.value)) this.selectedCollections.delete(c.value);
					else this.selectedCollections.add(c.value);
					void this.render();
				})
			);
		}
		menu.showAtMouseEvent(e);
	}

	private async showTagsMenu(e: MouseEvent, sources: string[]) {
		e.stopPropagation();
		const tags = (await this.fetchAllTags(sources))
			.sort((a, b) => (a.label ?? a.value).localeCompare(b.label ?? b.value));
		const menu = new Menu();
		for (const t of tags) {
			menu.addItem(item => item
				.setTitle(t.label ?? t.value)
				.setIcon(sourceIconId(t.source))
				.setChecked(this.selectedTags.has(t.value))
				.onClick(() => {
					if (this.selectedTags.has(t.value)) this.selectedTags.delete(t.value);
					else this.selectedTags.add(t.value);
					void this.render();
				})
			);
		}
		menu.showAtMouseEvent(e);
	}

	private async renderItem(container: HTMLElement, item: ATBookmarkItem) {
		const el = container.createEl("div", { cls: "atmosphere-item" });

		el.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest(".atmosphere-item-edit-btn")) {
				return;
			}
			new CardDetailModal(this.plugin, item, () => {
				void this.refresh();
			}).open();
		});

		const source = item.getSource();

		const header = el.createEl("div", { cls: "atmosphere-item-header" });
		const title = item.getTitle();
		if (title) {
			header.createEl("div", { text: title, cls: "atmosphere-item-title" });
		}
		if (item.canEdit()) {
			const editBtn = header.createEl("button", {
				cls: "atmosphere-item-edit-btn",
			});
			setIcon(editBtn, "more-vertical");
			editBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				new EditItemModal(this.plugin, item, () => void this.refresh()).open();
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

		const imageUrl = await item.getImageUrl();
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
		const footerLeft = footer.createEl("div", { cls: "atmosphere-item-footer-left" });
		const sourceBadge = footerLeft.createEl("span", { cls: `atmosphere-badge atmosphere-badge-${source} atmosphere-item-source-icon` });
		setIcon(sourceBadge, sourceIconId(source));
		footerLeft.createEl("span", {
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
				text: collections.length === 1 ? collections[0]!.name : `${collections.length} collections`,
				cls: "atmosphere-collection-indicator-name",
			});
		}
	}

	async onClose() { }
}

function sourceIconId(source: string): string {
	if (source === "semble") return "atmosphere-semble";
	if (source === "margin") return "atmosphere-margin";
	return "bookmark";
}
