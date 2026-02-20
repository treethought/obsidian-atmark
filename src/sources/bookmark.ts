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
	private collections: Array<{ uri: string; name: string }> = [];

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

	getCollections(): Array<{ uri: string; name: string }> {
		return this.collections;
	}

	setCollections(collections: Array<{ uri: string; name: string }>) {
		this.collections = collections;
	}

	openEditModal(onSuccess?: () => void): void {
		new EditBookmarkModal(this.plugin, this.record, onSuccess).open();
	}

	render(container: HTMLElement): void {
		const el = container.createEl("div", { cls: "atmosphere-item-content" });
		const bookmark = this.record.value;
		const enriched = bookmark.enriched;

		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsContainer = el.createEl("div", { cls: "atmosphere-item-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "atmosphere-tag" });
			}
		}

		const title = enriched?.title || bookmark.title;
		if (title) {
			el.createEl("div", { text: title, cls: "atmosphere-item-title" });
		}

		const imageUrl = enriched?.image || enriched?.thumb;
		if (imageUrl) {
			const img = el.createEl("img", { cls: "atmosphere-item-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = enriched?.description || bookmark.description;
		if (description) {
			const desc = description.length > 200
				? description.slice(0, 200) + "…"
				: description;
			el.createEl("p", { text: desc, cls: "atmosphere-item-desc" });
		}

		if (enriched?.siteName) {
			el.createEl("span", { text: enriched.siteName, cls: "atmosphere-item-site" });
		}

		const link = el.createEl("a", {
			text: bookmark.subject,
			href: bookmark.subject,
			cls: "atmosphere-item-url",
		});
		link.setAttr("target", "_blank");
	}

	renderDetail(container: HTMLElement): void {
		const body = container.createEl("div", { cls: "atmosphere-detail-body" });
		const bookmark = this.record.value;
		const enriched = bookmark.enriched;

		const title = enriched?.title || bookmark.title;
		if (title) {
			body.createEl("h2", { text: title, cls: "atmosphere-detail-title" });
		}

		const imageUrl = enriched?.image || enriched?.thumb;
		if (imageUrl) {
			const img = body.createEl("img", { cls: "atmosphere-detail-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = enriched?.description || bookmark.description;
		if (description) {
			body.createEl("p", { text: description, cls: "atmosphere-detail-description" });
		}

		if (enriched?.siteName) {
			const metaGrid = body.createEl("div", { cls: "atmosphere-detail-meta" });
			const item = metaGrid.createEl("div", { cls: "atmosphere-detail-meta-item" });
			item.createEl("span", { text: "Site", cls: "atmosphere-detail-meta-label" });
			item.createEl("span", { text: enriched.siteName, cls: "atmosphere-detail-meta-value" });
		}

		const linkWrapper = body.createEl("div", { cls: "atmosphere-detail-link-wrapper" });
		const link = linkWrapper.createEl("a", {
			text: bookmark.subject,
			href: bookmark.subject,
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

	getTags() {
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

