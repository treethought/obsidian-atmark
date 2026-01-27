import type { Client } from "@atcute/client";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import { setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import { getBookmarks } from "../lib";
import type { ATmarkItem, DataSource, SourceFilter } from "./types";
import { EditBookmarkModal } from "../components/editBookmarkModal";
import { CreateTagModal } from "../components/createTagModal";
import type { Main as Bookmark } from "../lexicons/types/community/lexicon/bookmarks/bookmark";

type BookmarkRecord = Record & { value: Bookmark };

class BookmarkItem implements ATmarkItem {
	private record: BookmarkRecord;
	private plugin: ATmarkPlugin;

	constructor(record: BookmarkRecord, plugin: ATmarkPlugin) {
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

	openEditModal(onSuccess?: () => void): void {
		new EditBookmarkModal(this.plugin, this.record, onSuccess).open();
	}

	render(container: HTMLElement): void {
		const el = container.createEl("div", { cls: "atmark-item-content" });
		const bookmark = this.record.value;
		const enriched = bookmark.enriched;

		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsContainer = el.createEl("div", { cls: "atmark-item-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "atmark-tag" });
			}
		}

		const title = enriched?.title || bookmark.title;
		if (title) {
			el.createEl("div", { text: title, cls: "atmark-item-title" });
		}

		const imageUrl = enriched?.image || enriched?.thumb;
		if (imageUrl) {
			const img = el.createEl("img", { cls: "atmark-item-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = enriched?.description || bookmark.description;
		if (description) {
			const desc = description.length > 200
				? description.slice(0, 200) + "…"
				: description;
			el.createEl("p", { text: desc, cls: "atmark-item-desc" });
		}

		if (enriched?.siteName) {
			el.createEl("span", { text: enriched.siteName, cls: "atmark-item-site" });
		}

		const link = el.createEl("a", {
			text: bookmark.subject,
			href: bookmark.subject,
			cls: "atmark-item-url",
		});
		link.setAttr("target", "_blank");
	}

	renderDetail(container: HTMLElement): void {
		const body = container.createEl("div", { cls: "atmark-detail-body" });
		const bookmark = this.record.value;
		const enriched = bookmark.enriched;

		const title = enriched?.title || bookmark.title;
		if (title) {
			body.createEl("h2", { text: title, cls: "atmark-detail-title" });
		}

		const imageUrl = enriched?.image || enriched?.thumb;
		if (imageUrl) {
			const img = body.createEl("img", { cls: "atmark-detail-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = enriched?.description || bookmark.description;
		if (description) {
			body.createEl("p", { text: description, cls: "atmark-detail-description" });
		}

		if (enriched?.siteName) {
			const metaGrid = body.createEl("div", { cls: "atmark-detail-meta" });
			const item = metaGrid.createEl("div", { cls: "atmark-detail-meta-item" });
			item.createEl("span", { text: "Site", cls: "atmark-detail-meta-label" });
			item.createEl("span", { text: enriched.siteName, cls: "atmark-detail-meta-value" });
		}

		const linkWrapper = body.createEl("div", { cls: "atmark-detail-link-wrapper" });
		const link = linkWrapper.createEl("a", {
			text: bookmark.subject,
			href: bookmark.subject,
			cls: "atmark-detail-link",
		});
		link.setAttr("target", "_blank");

		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsSection = container.createEl("div", { cls: "atmark-item-tags-section" });
			tagsSection.createEl("h3", { text: "Tags", cls: "atmark-detail-section-title" });
			const tagsContainer = tagsSection.createEl("div", { cls: "atmark-item-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "atmark-tag" });
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

	async fetchItems(filters: SourceFilter[], plugin: ATmarkPlugin): Promise<ATmarkItem[]> {
		const bookmarksResp = await getBookmarks(this.client, this.repo);
		if (!bookmarksResp.ok) return [];

		let bookmarks = bookmarksResp.data.records as BookmarkRecord[];

		const tagFilter = filters.find(f => f.type === "bookmarkTag");
		if (tagFilter && tagFilter.value) {
			bookmarks = bookmarks.filter((record: BookmarkRecord) =>
				record.value.tags?.includes(tagFilter.value)
			);
		}

		return bookmarks.map((record: BookmarkRecord) => new BookmarkItem(record, plugin));
	}

	async getAvailableFilters(): Promise<SourceFilter[]> {
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

		return Array.from(tagSet).map(tag => ({
			type: "bookmarkTag",
			value: tag,
			label: tag,
		}));
	}

	renderFilterUI(container: HTMLElement, activeFilters: Map<string, SourceFilter>, onChange: () => void, plugin: ATmarkPlugin): void {
		const section = container.createEl("div", { cls: "atmark-filter-section" });

		const titleRow = section.createEl("div", { cls: "atmark-filter-title-row" });
		titleRow.createEl("h3", { text: "Tags", cls: "atmark-filter-title" });

		const createBtn = titleRow.createEl("button", { cls: "atmark-filter-create-btn" });
		setIcon(createBtn, "plus");
		createBtn.addEventListener("click", () => {
			new CreateTagModal(plugin, onChange).open();
		});

		const chips = section.createEl("div", { cls: "atmark-filter-chips" });

		const allChip = chips.createEl("button", {
			text: "All",
			cls: `atmark-chip ${!activeFilters.has("bookmarkTag") ? "atmark-chip-active" : ""}`,
		});
		allChip.addEventListener("click", () => {
			activeFilters.delete("bookmarkTag");
			onChange();
		});

		void this.getAvailableFilters().then(tags => {
			for (const tag of tags) {
				const chip = chips.createEl("button", {
					text: tag.label,
					cls: `atmark-chip ${activeFilters.get("bookmarkTag")?.value === tag.value ? "atmark-chip-active" : ""}`,
				});
				chip.addEventListener("click", () => {
					activeFilters.set("bookmarkTag", tag);
					onChange();
				});
			}
		});
	}
}
