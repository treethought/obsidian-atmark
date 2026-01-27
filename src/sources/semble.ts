import type { Client } from "@atcute/client";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import { setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import { getCards, getCollections, getCollectionLinks } from "../lib";
import type { Main as Card, NoteContent, UrlContent } from "../lexicons/types/network/cosmik/card";
import type { Main as Collection } from "../lexicons/types/network/cosmik/collection";
import type { Main as CollectionLink } from "../lexicons/types/network/cosmik/collectionLink";
import type { ATmarkItem, DataSource, SourceFilter } from "./types";
import { EditCardModal } from "../components/editCardModal";
import { CreateCollectionModal } from "../components/createCollectionModal";

type CardRecord = Record & { value: Card };
type CollectionRecord = Record & { value: Collection };
type CollectionLinkRecord = Record & { value: CollectionLink };

class SembleItem implements ATmarkItem {
	private record: CardRecord;
	private attachedNotes: Array<{ uri: string; text: string }>;
	private plugin: ATmarkPlugin;

	constructor(record: CardRecord, attachedNotes: Array<{ uri: string; text: string }>, plugin: ATmarkPlugin) {
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
		return this.record.value.createdAt || new Date().toISOString();
	}

	getSource(): "semble" {
		return "semble";
	}

	canAddNotes(): boolean {
		return true;
	}

	canEdit(): boolean {
		return true;
	}

	openEditModal(onSuccess?: () => void): void {
		new EditCardModal(this.plugin, this.record.uri, this.record.cid, onSuccess).open();
	}

	render(container: HTMLElement): void {
		const el = container.createEl("div", { cls: "atmark-item-content" });

		const card = this.record.value;

		if (card.type === "NOTE") {
			const content = card.content as NoteContent;
			el.createEl("p", { text: content.text, cls: "semble-card-text" });
		} else if (card.type === "URL") {
			const content = card.content as UrlContent;
			const meta = content.metadata;

			if (meta?.title) {
				el.createEl("div", { text: meta.title, cls: "atmark-item-title" });
			}

			if (meta?.imageUrl) {
				const img = el.createEl("img", { cls: "atmark-item-image" });
				img.src = meta.imageUrl;
				img.alt = meta.title || "Image";
			}

			if (meta?.description) {
				const desc = meta.description.length > 200
					? meta.description.slice(0, 200) + "…"
					: meta.description;
				el.createEl("p", { text: desc, cls: "atmark-item-desc" });
			}

			if (meta?.siteName) {
				el.createEl("span", { text: meta.siteName, cls: "atmark-item-site" });
			}

			const link = el.createEl("a", {
				text: content.url,
				href: content.url,
				cls: "atmark-item-url",
			});
			link.setAttr("target", "_blank");
		}
	}

	renderDetail(container: HTMLElement): void {
		const body = container.createEl("div", { cls: "atmark-detail-body" });
		const card = this.record.value;

		if (card.type === "NOTE") {
			const content = card.content as NoteContent;
			body.createEl("p", { text: content.text, cls: "semble-detail-text" });
		} else if (card.type === "URL") {
			const content = card.content as UrlContent;
			const meta = content.metadata;

			if (meta?.title) {
				body.createEl("h2", { text: meta.title, cls: "atmark-detail-title" });
			}

			if (meta?.imageUrl) {
				const img = body.createEl("img", { cls: "atmark-detail-image" });
				img.src = meta.imageUrl;
				img.alt = meta.title || "Image";
			}

			if (meta?.description) {
				body.createEl("p", { text: meta.description, cls: "atmark-detail-description" });
			}

			if (meta?.siteName) {
				const metaGrid = body.createEl("div", { cls: "atmark-detail-meta" });
				const item = metaGrid.createEl("div", { cls: "atmark-detail-meta-item" });
				item.createEl("span", { text: "Site", cls: "atmark-detail-meta-label" });
				item.createEl("span", { text: meta.siteName, cls: "atmark-detail-meta-value" });
			}

			const linkWrapper = body.createEl("div", { cls: "atmark-detail-link-wrapper" });
			const link = linkWrapper.createEl("a", {
				text: content.url,
				href: content.url,
				cls: "atmark-detail-link",
			});
			link.setAttr("target", "_blank");
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

		const allSembleCards = cardsResp.data.records as CardRecord[];

		const notesMap = new Map<string, Array<{ uri: string; text: string }>>();
		for (const record of allSembleCards) {
			if (record.value.type === "NOTE") {
				const parentUri = record.value.parentCard?.uri;
				if (parentUri) {
					const noteContent = record.value.content as NoteContent;
					const existing = notesMap.get(parentUri) || [];
					existing.push({ uri: record.uri, text: noteContent.text });
					notesMap.set(parentUri, existing);
				}
			}
		}

		// Filter out NOTE cards that are attached to other cards
		let sembleCards = allSembleCards.filter((record: CardRecord) => {
			if (record.value.type === "NOTE") {
				const hasParent = record.value.parentCard?.uri;
				return !hasParent;
			}
			return true;
		});

		const collectionFilter = filters.find(f => f.type === "sembleCollection");
		if (collectionFilter && collectionFilter.value) {
			const linksResp = await getCollectionLinks(this.client, this.repo);
			if (linksResp.ok) {
				const links = linksResp.data.records as CollectionLinkRecord[];
				const filteredLinks = links.filter((link: CollectionLinkRecord) =>
					link.value.collection.uri === collectionFilter.value
				);
				const cardUris = new Set(filteredLinks.map((link: CollectionLinkRecord) => link.value.card.uri));
				sembleCards = sembleCards.filter((card: CardRecord) => cardUris.has(card.uri));
			}
		}

		return sembleCards.map((record: CardRecord) =>
			new SembleItem(record, notesMap.get(record.uri) || [], plugin)
		);
	}

	async getAvailableFilters(): Promise<SourceFilter[]> {
		const collectionsResp = await getCollections(this.client, this.repo);
		if (!collectionsResp.ok) return [];

		const collections = collectionsResp.data.records as CollectionRecord[];
		return collections.map((c: CollectionRecord) => ({
			type: "sembleCollection",
			value: c.uri,
			label: c.value.name,
		}));
	}

	renderFilterUI(container: HTMLElement, activeFilters: Map<string, SourceFilter>, onChange: () => void, plugin: ATmarkPlugin): void {
		const section = container.createEl("div", { cls: "atmark-filter-section" });

		const titleRow = section.createEl("div", { cls: "atmark-filter-title-row" });
		titleRow.createEl("h3", { text: "Semble collections", cls: "atmark-filter-title" });

		const createBtn = titleRow.createEl("button", { cls: "atmark-filter-create-btn" });
		setIcon(createBtn, "plus");
		createBtn.addEventListener("click", () => {
			new CreateCollectionModal(plugin, onChange).open();
		});

		const chips = section.createEl("div", { cls: "atmark-filter-chips" });

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
					text: collection.label,
					cls: `atmark-chip ${activeFilters.get("sembleCollection")?.value === collection.value ? "atmark-chip-active" : ""}`,
				});
				chip.addEventListener("click", () => {
					activeFilters.set("sembleCollection", collection);
					onChange();
				});
			}
		});
	}
}
