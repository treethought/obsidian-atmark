import type { Client } from "@atcute/client";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import type AtmospherePlugin from "../main";
import { getMarginBookmarks, getMarginCollections, getMarginCollectionItems } from "../lib";
import type { ATBookmarkItem, CollectionAssociation, DataSource, SourceFilter } from "./types";
import type { Main as MarginBookmark } from "../lexicons/types/at/margin/bookmark";
import type { Main as MarginCollection } from "../lexicons/types/at/margin/collection";
import type { Main as MarginCollectionItem } from "../lexicons/types/at/margin/collectionItem";
import { EditMarginBookmarkModal } from "../components/editMarginBookmarkModal";

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

	getTitle(): string | undefined {
		return this.record.value.title || undefined;
	}

	getDescription(): string | undefined {
		return this.record.value.description || undefined;
	}

	getImageUrl(): string | undefined {
		return undefined;
	}

	getUrl(): string | undefined {
		return this.record.value.source;
	}

	getSiteName(): string | undefined {
		return undefined;
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

		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsSection = container.createEl("div", { cls: "atmosphere-item-tags-section" });
			tagsSection.createEl("h3", { text: "Tags", cls: "atmosphere-detail-section-title" });
			const tagsContainer = tagsSection.createEl("div", { cls: "atmosphere-item-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "atmosphere-tag" });
			}
		}
	}

	getCollections(): Array<{ uri: string; name: string }> {
		return this.collections;
	}

	setCollections(collections: Array<{ uri: string; name: string }>) {
		this.collections = collections;
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

	async fetchItems(plugin: AtmospherePlugin, filteredCollections: Set<string>, filteredTags: Set<string>): Promise<ATBookmarkItem[]> {
		const bookmarksResp = await getMarginBookmarks(this.client, this.repo);
		if (!bookmarksResp.ok) return [];

		let bookmarks = bookmarksResp.data.records as MarginBookmarkRecord[];

		if (filteredCollections.size > 0) {
			bookmarks = bookmarks.filter((bookmark: MarginBookmarkRecord) => filteredCollections.has(bookmark.uri));
		}

		if (filteredTags.size > 0) {
			bookmarks = bookmarks.filter((record: MarginBookmarkRecord) =>
				record.value.tags?.some(t => filteredTags.has(t))
			);
		}

		return bookmarks.map((record: MarginBookmarkRecord) =>
			new MarginItem(record, [], plugin)
		);
	}
	async getAvailableCollections(): Promise<SourceFilter[]> {
		const collectionsResp = await getMarginCollections(this.client, this.repo);
		if (!collectionsResp.ok) return [];

		const collections = collectionsResp.data.records as MarginCollectionRecord[];
		return collections.map((c: MarginCollectionRecord) => ({
			value: c.uri,
			label: c.value.name,
		}));
	}
	async getCollectionAssociations(): Promise<CollectionAssociation[]> {
		const itemsResp = await getMarginCollectionItems(this.client, this.repo);
		if (!itemsResp.ok) return [];

		return (itemsResp.data.records as MarginCollectionItemRecord[]).map(item => ({
			record: item.value.annotation,
			collection: item.value.collection,
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
		return Array.from(tagSet).map(tag => ({ value: tag, label: tag }));

	}

}

