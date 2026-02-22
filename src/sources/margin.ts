import type { Client } from "@atcute/client";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import type AtmospherePlugin from "../main";
import { getMarginBookmarks, getMarginCollections, getMarginCollectionItems, deleteRecord, createMarginCollectionItem, getRecord, putRecord } from "../lib";
import type { ATBookmarkItem, CollectionAssociation, DataSource, SourceFilter } from "./types";
import type { Main as MarginBookmark } from "../lexicons/types/at/margin/bookmark";
import type { Main as MarginCollection } from "../lexicons/types/at/margin/collection";
import type { Main as MarginCollectionItem } from "../lexicons/types/at/margin/collectionItem";
import { fetchOgImage } from "../util"

type MarginBookmarkRecord = Record & { value: MarginBookmark };
type MarginCollectionRecord = Record & { value: MarginCollection };
type MarginCollectionItemRecord = Record & { value: MarginCollectionItem };

class MarginItem implements ATBookmarkItem {
	private record: MarginBookmarkRecord;
	private plugin: AtmospherePlugin;
	private collections: Array<{ uri: string; name: string; source: string }>;

	constructor(record: MarginBookmarkRecord, collections: Array<{ uri: string; name: string; source: string }>, plugin: AtmospherePlugin) {
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

	canAddTags(): boolean {
		return true;
	}

	canAddToCollections(): boolean {
		return true;
	}

	canEdit(): boolean {
		return true;
	}


	getTitle(): string | undefined {
		return this.record.value.title || undefined;
	}

	getDescription(): string | undefined {
		return this.record.value.description || undefined;
	}

	async getImageUrl(): Promise<string | undefined> {
		return fetchOgImage(this.record.value.source);
	}

	getUrl(): string | undefined {
		return this.record.value.source;
	}

	getSiteName(): string | undefined {
		return undefined;
	}

	getCollections(): Array<{ uri: string; name: string; source: string }> {
		return this.collections;
	}

	setCollections(collections: Array<{ uri: string; name: string; source: string }>) {
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
			description: c.value.description,
		}));
	}

	async getCollectionAssociations(): Promise<CollectionAssociation[]> {
		const itemsResp = await getMarginCollectionItems(this.client, this.repo);
		if (!itemsResp.ok) return [];

		return (itemsResp.data.records as MarginCollectionItemRecord[]).map(item => ({
			record: item.value.annotation,
			collection: item.value.collection,
			linkUri: item.uri,
		}));
	}

	async deleteItem(itemUri: string): Promise<void> {
		const rkey = itemUri.split("/").pop();
		if (!rkey) throw new Error("Invalid URI");
		await deleteRecord(this.client, this.repo, "at.margin.bookmark", rkey);
	}

	async addToCollection(itemUri: string, _itemCid: string, collectionUri: string): Promise<void> {
		await createMarginCollectionItem(this.client, this.repo, itemUri, collectionUri);
	}

	async removeFromCollection(linkUri: string): Promise<void> {
		const rkey = linkUri.split("/").pop();
		if (!rkey) throw new Error("Invalid link URI");
		await deleteRecord(this.client, this.repo, "at.margin.collectionItem", rkey);
	}

	async updateTags(itemUri: string, tags: string[]): Promise<void> {
		const rkey = itemUri.split("/").pop();
		if (!rkey) throw new Error("Invalid URI");
		const resp = await getRecord(this.client, this.repo, "at.margin.bookmark", rkey);
		if (!resp.ok) throw new Error("Failed to fetch record");
		const existing = resp.data.value as MarginBookmark;
		await putRecord(this.client, this.repo, "at.margin.bookmark", rkey, { ...existing, tags });
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

