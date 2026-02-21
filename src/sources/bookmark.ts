import type { Client } from "@atcute/client";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import type AtmospherePlugin from "../main";
import { getBookmarks } from "../lib";
import type { ATBookmarkItem, DataSource, SourceFilter } from "./types";
import { EditBookmarkModal } from "../components/editBookmarkModal";
import type { Main as Bookmark } from "../lexicons/types/community/lexicon/bookmarks/bookmark";

type BookmarkRecord = Record & { value: Bookmark };

class BookmarkItem implements ATBookmarkItem {
	private record: BookmarkRecord;
	private plugin: AtmospherePlugin;
	private collections: Array<{ uri: string; name: string; source: string }> = [];

	constructor(record: BookmarkRecord, plugin: AtmospherePlugin) {
		this.record = record;
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

	getSource(): "bookmark" {
		return "bookmark";
	}

	canAddNotes(): boolean {
		return false;
	}

	canEdit(): boolean {
		return true;
	}

	getCollections(): Array<{ uri: string; name: string; source: string }> {
		return this.collections;
	}

	setCollections(collections: Array<{ uri: string; name: string; source: string }>) {
		this.collections = collections;
	}

	canAddTags(): boolean {
		return true;
	}

	openEditModal(onSuccess?: () => void): void {
		new EditBookmarkModal(this.plugin, this.record, onSuccess).open();
	}

	getTitle(): string | undefined {
		const enriched = this.record.value.enriched;
		return enriched?.title || this.record.value.title || undefined;
	}

	getDescription(): string | undefined {
		const enriched = this.record.value.enriched;
		return enriched?.description || this.record.value.description || undefined;
	}

	getImageUrl(): string | undefined {
		const enriched = this.record.value.enriched;
		return enriched?.image || enriched?.thumb || undefined;
	}

	getUrl(): string | undefined {
		return this.record.value.subject;
	}

	getSiteName(): string | undefined {
		return this.record.value.enriched?.siteName || undefined;
	}

	getTags(): string[] {
		return this.record.value.tags || [];
	}

	getRecord() {
		return this.record;
	}
}

export class BookmarkSource implements DataSource {
	readonly name = "bookmark" as const;
	private client: Client;
	private repo: string;

	constructor(client: Client, repo: string) {
		this.client = client;
		this.repo = repo;
	}

	async fetchItems(plugin: AtmospherePlugin, _filteredCollections: Set<string> | undefined, filteredTags: Set<string>): Promise<ATBookmarkItem[]> {
		const bookmarksResp = await getBookmarks(this.client, this.repo);
		if (!bookmarksResp.ok) return [];

		let bookmarks = bookmarksResp.data.records as BookmarkRecord[];

		// no collecitons for community bookmarks

		if (filteredTags.size > 0) {
			bookmarks = bookmarks.filter((record: BookmarkRecord) =>
				record.value.tags?.some(t => filteredTags.has(t))
			);
		}

		return bookmarks.map((record: BookmarkRecord) => new BookmarkItem(record, plugin));
	}

	async getAvilableTags(): Promise<SourceFilter[]> {
		const bookmarksResp = await getBookmarks(this.client, this.repo);
		if (!bookmarksResp.ok) return [];

		const tagSet = new Set<string>();
		const records = bookmarksResp.data.records as BookmarkRecord[];
		for (const record of records) {
			if (record.value.tags) {
				for (const tag of record.value.tags) {
					tagSet.add(tag);
				}
			}
		}

		return Array.from(tagSet).map(tag => ({ value: tag, label: tag }));
	}

}

