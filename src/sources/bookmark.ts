import type { Client } from "@atcute/client";
import type ATmarkPlugin from "../main";
import { getBookmarks } from "../lib";
import type { ATmarkItem, DataSource, SourceFilter } from "./types";

class BookmarkItem implements ATmarkItem {
	private record: any;
	private plugin: ATmarkPlugin;

	constructor(record: any, plugin: ATmarkPlugin) {
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

	render(container: HTMLElement): void {
		const el = container.createEl("div", { cls: "semble-card-content" });
		const bookmark = this.record.value;
		const enriched = bookmark.enriched;

		// Display tags
		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsContainer = el.createEl("div", { cls: "semble-card-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "semble-tag" });
			}
		}

		const title = enriched?.title || bookmark.title;
		if (title) {
			el.createEl("div", { text: title, cls: "semble-card-title" });
		}

		const imageUrl = enriched?.image || enriched?.thumb;
		if (imageUrl) {
			const img = el.createEl("img", { cls: "semble-card-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = enriched?.description || bookmark.description;
		if (description) {
			const desc = description.length > 200
				? description.slice(0, 200) + "…"
				: description;
			el.createEl("p", { text: desc, cls: "semble-card-desc" });
		}

		if (enriched?.siteName) {
			el.createEl("span", { text: enriched.siteName, cls: "semble-card-site" });
		}

		const link = el.createEl("a", {
			text: bookmark.subject,
			href: bookmark.subject,
			cls: "semble-card-url",
		});
		link.setAttr("target", "_blank");
	}

	renderDetail(container: HTMLElement): void {
		const body = container.createEl("div", { cls: "semble-detail-body" });
		const bookmark = this.record.value;
		const enriched = bookmark.enriched;

		const title = enriched?.title || bookmark.title;
		if (title) {
			body.createEl("h2", { text: title, cls: "semble-detail-title" });
		}

		const imageUrl = enriched?.image || enriched?.thumb;
		if (imageUrl) {
			const img = body.createEl("img", { cls: "semble-detail-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = enriched?.description || bookmark.description;
		if (description) {
			body.createEl("p", { text: description, cls: "semble-detail-description" });
		}

		if (enriched?.siteName) {
			const metaGrid = body.createEl("div", { cls: "semble-detail-meta" });
			const item = metaGrid.createEl("div", { cls: "semble-detail-meta-item" });
			item.createEl("span", { text: "Site", cls: "semble-detail-meta-label" });
			item.createEl("span", { text: enriched.siteName, cls: "semble-detail-meta-value" });
		}

		const linkWrapper = body.createEl("div", { cls: "semble-detail-link-wrapper" });
		const link = linkWrapper.createEl("a", {
			text: bookmark.subject,
			href: bookmark.subject,
			cls: "semble-detail-link",
		});
		link.setAttr("target", "_blank");

		// Tags section
		if (bookmark.tags && bookmark.tags.length > 0) {
			const tagsSection = container.createEl("div", { cls: "semble-detail-tags-section" });
			tagsSection.createEl("h3", { text: "Tags", cls: "semble-detail-section-title" });
			const tagsContainer = tagsSection.createEl("div", { cls: "semble-card-tags" });
			for (const tag of bookmark.tags) {
				tagsContainer.createEl("span", { text: tag, cls: "semble-tag" });
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

		let bookmarks = bookmarksResp.data.records;

		// Apply tag filter if specified
		const tagFilter = filters.find(f => f.type === "bookmarkTag");
		if (tagFilter && tagFilter.value) {
			bookmarks = bookmarks.filter((record: any) =>
				record.value.tags?.includes(tagFilter.value)
			);
		}

		return bookmarks.map((record: any) => new BookmarkItem(record, plugin));
	}

	async getAvailableFilters(): Promise<SourceFilter[]> {
		const bookmarksResp = await getBookmarks(this.client, this.repo);
		if (!bookmarksResp.ok) return [];

		// Extract unique tags
		const tagSet = new Set<string>();
		const records = bookmarksResp.data.records as any[];
		for (const record of records) {
			if (record.value?.tags) {
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

	renderFilterUI(container: HTMLElement, activeFilters: Map<string, any>, onChange: () => void): void {
		const section = container.createEl("div", { cls: "atmark-filter-section" });
		section.createEl("h3", { text: "Tags", cls: "atmark-filter-title" });

		const chips = section.createEl("div", { cls: "atmark-filter-chips" });

		// All chip
		const allChip = chips.createEl("button", {
			text: "All",
			cls: `atmark-chip ${!activeFilters.has("bookmarkTag") ? "atmark-chip-active" : ""}`,
		});
		allChip.addEventListener("click", () => {
			activeFilters.delete("bookmarkTag");
			onChange();
		});

		// Get tags and render chips
		void this.getAvailableFilters().then(tags => {
			for (const tag of tags) {
				const chip = chips.createEl("button", {
					text: (tag as any).label,
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
