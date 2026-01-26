import type { Client } from "@atcute/client";
import { setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import { getCards, getCollections, getCollectionLinks } from "../lib";
import type { NoteContent, UrlContent } from "../lexicons/types/network/cosmik/card";
import type { ATmarkItem, DataSource, SourceFilter } from "./types";

class SembleItem implements ATmarkItem {
	private record: any;
	private attachedNotes: Array<{ uri: string; text: string }>;
	private plugin: ATmarkPlugin;

	constructor(record: any, attachedNotes: Array<{ uri: string; text: string }>, plugin: ATmarkPlugin) {
		this.record = record;
		this.attachedNotes = attachedNotes;
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

	getSource(): "semble" {
		return "semble";
	}

	canAddNotes(): boolean {
		return true;
	}

	render(container: HTMLElement): void {
		const el = container.createEl("div", { cls: "semble-card-content" });

		// Display attached notes
		if (this.attachedNotes.length > 0) {
			for (const note of this.attachedNotes) {
				el.createEl("p", { text: note.text, cls: "semble-card-note" });
			}
		}

		const card = this.record.value;

		if (card.type === "NOTE") {
			const content = card.content as NoteContent;
			el.createEl("p", { text: content.text, cls: "semble-card-text" });
		} else if (card.type === "URL") {
			const content = card.content as UrlContent;
			const meta = content.metadata;

			if (meta?.title) {
				el.createEl("div", { text: meta.title, cls: "semble-card-title" });
			}

			if (meta?.imageUrl) {
				const img = el.createEl("img", { cls: "semble-card-image" });
				img.src = meta.imageUrl;
				img.alt = meta.title || "Image";
			}

			if (meta?.description) {
				const desc = meta.description.length > 200
					? meta.description.slice(0, 200) + "…"
					: meta.description;
				el.createEl("p", { text: desc, cls: "semble-card-desc" });
			}

			if (meta?.siteName) {
				el.createEl("span", { text: meta.siteName, cls: "semble-card-site" });
			}

			const link = el.createEl("a", {
				text: content.url,
				href: content.url,
				cls: "semble-card-url",
			});
			link.setAttr("target", "_blank");
		}
	}

	renderDetail(container: HTMLElement): void {
		const body = container.createEl("div", { cls: "semble-detail-body" });
		const card = this.record.value;

		if (card.type === "NOTE") {
			const content = card.content as NoteContent;
			body.createEl("p", { text: content.text, cls: "semble-detail-text" });
		} else if (card.type === "URL") {
			const content = card.content as UrlContent;
			const meta = content.metadata;

			if (meta?.title) {
				body.createEl("h2", { text: meta.title, cls: "semble-detail-title" });
			}

			if (meta?.imageUrl) {
				const img = body.createEl("img", { cls: "semble-detail-image" });
				img.src = meta.imageUrl;
				img.alt = meta.title || "Image";
			}

			if (meta?.description) {
				body.createEl("p", { text: meta.description, cls: "semble-detail-description" });
			}

			if (meta?.siteName) {
				const metaGrid = body.createEl("div", { cls: "semble-detail-meta" });
				const item = metaGrid.createEl("div", { cls: "semble-detail-meta-item" });
				item.createEl("span", { text: "Site", cls: "semble-detail-meta-label" });
				item.createEl("span", { text: meta.siteName, cls: "semble-detail-meta-value" });
			}

			const linkWrapper = body.createEl("div", { cls: "semble-detail-link-wrapper" });
			const link = linkWrapper.createEl("a", {
				text: content.url,
				href: content.url,
				cls: "semble-detail-link",
			});
			link.setAttr("target", "_blank");
		}

		// Attached notes section
		if (this.attachedNotes.length > 0) {
			const notesSection = container.createEl("div", { cls: "semble-detail-notes-section" });
			notesSection.createEl("h3", { text: "Notes", cls: "semble-detail-section-title" });

			for (const note of this.attachedNotes) {
				const noteEl = notesSection.createEl("div", { cls: "semble-detail-note" });

				const noteContent = noteEl.createEl("div", { cls: "semble-detail-note-content" });
				const noteIcon = noteContent.createEl("span", { cls: "semble-detail-note-icon" });
				setIcon(noteIcon, "message-square");
				noteContent.createEl("p", { text: note.text, cls: "semble-detail-note-text" });

				// Note: delete functionality would need to be handled by the modal
			}
		}
	}

	getAttachedNotes() {
		return this.attachedNotes;
	}

	getRecord() {
		return this.record;
	}
}

export class SembleSource implements DataSource {
	readonly name = "semble" as const;
	private client: Client;
	private repo: string;

	constructor(client: Client, repo: string) {
		this.client = client;
		this.repo = repo;
	}

	async fetchItems(filters: SourceFilter[], plugin: ATmarkPlugin): Promise<ATmarkItem[]> {
		const cardsResp = await getCards(this.client, this.repo);
		if (!cardsResp.ok) return [];

		const allSembleCards = cardsResp.data.records;

		// Build notes map
		const notesMap = new Map<string, Array<{ uri: string; text: string }>>();
		for (const record of allSembleCards as any[]) {
			if (record.value.type === "NOTE") {
				const parentUri = record.value.originalCard?.uri || record.value.parentCard?.uri;
				if (parentUri) {
					const noteContent = record.value.content as NoteContent;
					const existing = notesMap.get(parentUri) || [];
					existing.push({ uri: record.uri, text: noteContent.text });
					notesMap.set(parentUri, existing);
				}
			}
		}

		// Filter out NOTE cards that are attached to other cards
		let sembleCards = allSembleCards.filter((record: any) => {
			if (record.value.type === "NOTE") {
				const hasParent = record.value.originalCard?.uri || record.value.parentCard?.uri;
				return !hasParent;
			}
			return true;
		});

		// Apply collection filter if specified
		const collectionFilter = filters.find(f => f.type === "sembleCollection");
		if (collectionFilter && collectionFilter.value) {
			const linksResp = await getCollectionLinks(this.client, this.repo);
			if (linksResp.ok) {
				const links = linksResp.data.records.filter((link: any) =>
					link.value.collection.uri === collectionFilter.value
				);
				const cardUris = new Set(links.map((link: any) => link.value.card.uri));
				sembleCards = sembleCards.filter((card: any) => cardUris.has(card.uri));
			}
		}

		// Create SembleItem objects
		return sembleCards.map((record: any) =>
			new SembleItem(record, notesMap.get(record.uri) || [], plugin)
		);
	}

	async getAvailableFilters(): Promise<SourceFilter[]> {
		const collectionsResp = await getCollections(this.client, this.repo);
		if (!collectionsResp.ok) return [];

		const collections = collectionsResp.data.records;
		return collections.map((c: any) => ({
			type: "sembleCollection",
			value: c.uri,
			label: c.value.name,
		}));
	}

	renderFilterUI(container: HTMLElement, activeFilters: Map<string, any>, onChange: () => void): void {
		const section = container.createEl("div", { cls: "atmark-filter-section" });
		section.createEl("h3", { text: "Semble Collections", cls: "atmark-filter-title" });

		const chips = section.createEl("div", { cls: "atmark-filter-chips" });

		// All chip
		const allChip = chips.createEl("button", {
			text: "All",
			cls: `atmark-chip ${!activeFilters.has("sembleCollection") ? "atmark-chip-active" : ""}`,
		});
		allChip.addEventListener("click", () => {
			activeFilters.delete("sembleCollection");
			onChange();
		});

		// Get collections synchronously - note: this is a limitation
		// In a real app, we'd want to cache these or handle async properly
		void this.getAvailableFilters().then(collections => {
			for (const collection of collections) {
				const chip = chips.createEl("button", {
					text: (collection as any).label,
					cls: `atmark-chip ${activeFilters.get("sembleCollection") === collection.value ? "atmark-chip-active" : ""}`,
				});
				chip.addEventListener("click", () => {
					activeFilters.set("sembleCollection", collection);
					onChange();
				});
			}
		});
	}
}
