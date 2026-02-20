import type { Client } from "@atcute/client";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import { setIcon } from "obsidian";
import type AtmospherePlugin from "../main";
import { getMarginBookmarks, getMarginCollections, getMarginCollectionItems } from "../lib";
import type { ATBookmarkItem, DataSource, SourceFilter } from "./types";
import type { Main as MarginBookmark } from "../lexicons/types/at/margin/bookmark";
import type { Main as MarginCollection } from "../lexicons/types/at/margin/collection";
import type { Main as MarginCollectionItem } from "../lexicons/types/at/margin/collectionItem";
import { EditMarginBookmarkModal } from "../components/editMarginBookmarkModal";
import { CreateMarginCollectionModal } from "../components/createMarginCollectionModal";

type MarginBookmarkRecord = Record & { value: MarginBookmark };
type MarginCollectionRecord = Record & { value: MarginCollection };
type MarginCollectionItemRecord = Record & { value: MarginCollectionItem };

class MarginItem implements ATBookmarkItem {
	private record: MarginBookmarkRecord;
	private plugin: AtmospherePlugin;
	private collections: Array<{ uri: string; name: string }>;

	constructor(record: MarginBookmarkRecord, collections: Array<{ uri: string; name: string }>, plugin: AtmospherePlugin) {
		this.record = record;
		this.collections = collections;
		this.plugin = plugin;
	}

	getUri(): string {
		return this.record.uri;
	}

	getCid(): string {
		return this.record.cid;
	}

	getCreatedAt(): string {
		return this.record.value.createdAt;
	}

	getSource(): "margin" {
		return "margin";
	}

	canAddNotes(): boolean {
		return false;
	}

	canEdit(): boolean {
		return true;
	}

	openEditModal(onSuccess?: () => void): void {
		new EditMarginBookmarkModal(this.plugin, this.record, onSuccess).open();
	}

	render(container: HTMLElement): void {
		const el = container.createEl("div", { cls: "atmosphere-item-content" });
		const bookmark = this.record.value;

		if (this.collections.length > 0) {
			const collectionsContainer = el.createEl("div", { cls: "atmosphere-item-collections" });
			for (const collection of this.collections) {
				collectionsContainer.createEl("span", { text: collection.name, cls: "atmosphere-collection" });
			}
		}

		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsContainer = el.createEl("div", { cls: "atmosphere-item-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "atmosphere-tag" });
			}
		}

		if (bookmark.title) {
			el.createEl("div", { text: bookmark.title, cls: "atmosphere-item-title" });
		}

		if (bookmark.description) {
			const desc = bookmark.description.length > 200
				? bookmark.description.slice(0, 200) + "…"
				: bookmark.description;
			el.createEl("p", { text: desc, cls: "atmosphere-item-desc" });
		}

		const link = el.createEl("a", {
			text: bookmark.source,
			href: bookmark.source,
			cls: "atmosphere-item-url",
		});
		link.setAttr("target", "_blank");
	}

	renderDetail(container: HTMLElement): void {
		const body = container.createEl("div", { cls: "atmosphere-detail-body" });
		const bookmark = this.record.value;

		if (bookmark.title) {
			body.createEl("h2", { text: bookmark.title, cls: "atmosphere-detail-title" });
		}

		if (bookmark.description) {
			body.createEl("p", { text: bookmark.description, cls: "atmosphere-detail-description" });
		}

		const linkWrapper = body.createEl("div", { cls: "atmosphere-detail-link-wrapper" });
		const link = linkWrapper.createEl("a", {
			text: bookmark.source,
			href: bookmark.source,
			cls: "atmosphere-detail-link",
		});
		link.setAttr("target", "_blank");

		if (this.collections.length > 0) {
			const collectionsSection = container.createEl("div", { cls: "atmosphere-item-collections-section" });
			collectionsSection.createEl("h3", { text: "Collections", cls: "atmosphere-detail-section-title" });
			const collectionsContainer = collectionsSection.createEl("div", { cls: "atmosphere-item-collections" });
			for (const collection of this.collections) {
				collectionsContainer.createEl("span", { text: collection.name, cls: "atmosphere-collection" });
			}
		}

		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsSection = container.createEl("div", { cls: "atmosphere-item-tags-section" });
			tagsSection.createEl("h3", { text: "Tags", cls: "atmosphere-detail-section-title" });
			const tagsContainer = tagsSection.createEl("div", { cls: "atmosphere-item-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "atmosphere-tag" });
			}
		}
	}

	getTags() {
		return this.record.value.tags || [];
	}

	getRecord() {
		return this.record;
	}
}

export class MarginSource implements DataSource {
	readonly name = "margin" as const;
	private client: Client;
	private repo: string;

	constructor(client: Client, repo: string) {
		this.client = client;
		this.repo = repo;
	}

	async fetchItems(filters: SourceFilter[], plugin: AtmospherePlugin): Promise<ATBookmarkItem[]> {
		const bookmarksResp = await getMarginBookmarks(this.client, this.repo);
		if (!bookmarksResp.ok) return [];

		let bookmarks = bookmarksResp.data.records as MarginBookmarkRecord[];

		// Build collections map (bookmark URI -> collection info)
		const collectionsMap = new Map<string, Array<{ uri: string; name: string }>>();
		const collectionsResp = await getMarginCollections(this.client, this.repo);
		const itemsResp = await getMarginCollectionItems(this.client, this.repo);

		if (collectionsResp.ok && itemsResp.ok) {
			const collections = collectionsResp.data.records as MarginCollectionRecord[];
			const collectionNameMap = new Map<string, string>();
			for (const collection of collections) {
				collectionNameMap.set(collection.uri, collection.value.name);
			}

			const items = itemsResp.data.records as MarginCollectionItemRecord[];
			for (const item of items) {
				const bookmarkUri = item.value.annotation;
				const collectionUri = item.value.collection;
				const collectionName = collectionNameMap.get(collectionUri);

				if (collectionName) {
					const existing = collectionsMap.get(bookmarkUri) || [];
					existing.push({ uri: collectionUri, name: collectionName });
					collectionsMap.set(bookmarkUri, existing);
				}
			}
		}

		const collectionFilter = filters.find(f => f.type === "marginCollection");
		if (collectionFilter && collectionFilter.value) {
			if (itemsResp.ok) {
				const items = itemsResp.data.records as MarginCollectionItemRecord[];
				const filteredItems = items.filter((item: MarginCollectionItemRecord) =>
					item.value.collection === collectionFilter.value
				);
				const bookmarkUris = new Set(filteredItems.map((item: MarginCollectionItemRecord) => item.value.annotation));
				bookmarks = bookmarks.filter((bookmark: MarginBookmarkRecord) => bookmarkUris.has(bookmark.uri));
			}
		}

		const tagFilter = filters.find(f => f.type === "marginTag");
		if (tagFilter && tagFilter.value) {
			bookmarks = bookmarks.filter((record: MarginBookmarkRecord) =>
				record.value.tags?.includes(tagFilter.value)
			);
		}

		return bookmarks.map((record: MarginBookmarkRecord) =>
			new MarginItem(record, collectionsMap.get(record.uri) || [], plugin)
		);
	}
	async getAvailableCollections(): Promise<SourceFilter[]> {
		const collectionsResp = await getMarginCollections(this.client, this.repo);
		if (!collectionsResp.ok) return [];

		const collections = collectionsResp.data.records as MarginCollectionRecord[];
		return collections.map((c: MarginCollectionRecord) => ({
			type: "marginCollection",
			value: c.uri,
			label: c.value.name,
		}));
	}
	async getAvilableTags(): Promise<SourceFilter[]> {
		const resp = await getMarginBookmarks(this.client, this.repo);
		if (!resp.ok) return [];

		const records = resp.data.records as MarginBookmarkRecord[];
		// return list of unique tags
		const tagSet = new Set<string>();
		records.forEach(record => {
			if (record.value.tags) {
				record.value.tags.forEach(tag => tagSet.add(tag));
			}
		});
		return Array.from(tagSet).map(tag => ({
			type: "marginTag",
			value: tag,
			label: tag,
		}));

	}

	async getAvailableFilters(): Promise<SourceFilter[]> {
		const filters: SourceFilter[] = [];

		const collectionsResp = await getMarginCollections(this.client, this.repo);
		if (collectionsResp.ok) {
			const collections = collectionsResp.data.records as MarginCollectionRecord[];
			filters.push(...collections.map((c: MarginCollectionRecord) => ({
				type: "marginCollection",
				value: c.uri,
				label: c.value.name,
			})));
		}

		const bookmarksResp = await getMarginBookmarks(this.client, this.repo);
		if (bookmarksResp.ok) {
			const tagSet = new Set<string>();
			const records = bookmarksResp.data.records as MarginBookmarkRecord[];
			for (const record of records) {
				if (record.value.tags) {
					for (const tag of record.value.tags) {
						tagSet.add(tag);
					}
				}
			}
			filters.push(...Array.from(tagSet).map(tag => ({
				type: "marginTag",
				value: tag,
				label: tag,
			})));
		}

		return filters;
	}

	renderFilterUI(container: HTMLElement, activeFilters: Map<string, SourceFilter>, onChange: () => void, onDataChange: () => void, plugin: AtmospherePlugin): void {
		const collectionsSection = container.createEl("div", { cls: "atmosphere-filter-section" });

		const collectionsTitleRow = collectionsSection.createEl("div", { cls: "atmosphere-filter-title-row" });
		collectionsTitleRow.createEl("h3", { text: "Collections", cls: "atmosphere-filter-title" });

		const createCollectionBtn = collectionsTitleRow.createEl("button", { cls: "atmosphere-filter-create-btn" });
		setIcon(createCollectionBtn, "plus");
		createCollectionBtn.addEventListener("click", () => {
			new CreateMarginCollectionModal(plugin, onDataChange).open();
		});

		const collectionsChips = collectionsSection.createEl("div", { cls: "atmosphere-filter-chips" });

		const allCollectionsChip = collectionsChips.createEl("button", {
			text: "All",
			cls: `atmosphere-chip ${!activeFilters.has("marginCollection") ? "atmosphere-chip-active" : ""}`,
		});
		allCollectionsChip.addEventListener("click", () => {
			activeFilters.delete("marginCollection");
			onChange();
		});

		const tagsSection = container.createEl("div", { cls: "atmosphere-filter-section" });

		const tagsTitleRow = tagsSection.createEl("div", { cls: "atmosphere-filter-title-row" });
		tagsTitleRow.createEl("h3", { text: "Tags", cls: "atmosphere-filter-title" });

		const tagsChips = tagsSection.createEl("div", { cls: "atmosphere-filter-chips" });

		const allTagsChip = tagsChips.createEl("button", {
			text: "All",
			cls: `atmosphere-chip ${!activeFilters.has("marginTag") ? "atmosphere-chip-active" : ""}`,
		});
		allTagsChip.addEventListener("click", () => {
			activeFilters.delete("marginTag");
			onChange();
		});

		void this.getAvailableFilters().then(filters => {
			for (const filter of filters) {
				if (filter.type === "marginCollection") {
					const chip = collectionsChips.createEl("button", {
						text: filter.label,
						cls: `atmosphere-chip ${activeFilters.get("marginCollection")?.value === filter.value ? "atmosphere-chip-active" : ""}`,
					});
					chip.addEventListener("click", () => {
						activeFilters.set("marginCollection", filter);
						onChange();
					});
				} else if (filter.type === "marginTag") {
					const chip = tagsChips.createEl("button", {
						text: filter.label,
						cls: `atmosphere-chip ${activeFilters.get("marginTag")?.value === filter.value ? "atmosphere-chip-active" : ""}`,
					});
					chip.addEventListener("click", () => {
						activeFilters.set("marginTag", filter);
						onChange();
					});
				}
			}
		});
	}
}
