import type { Client } from "@atcute/client";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import type AtmospherePlugin from "../main";
import { getSembleCollections, getSembleCards, getSembleCollectionLinks } from "../lib";
import type { Main as Card, NoteContent, UrlContent } from "../lexicons/types/network/cosmik/card";
import type { Main as Collection } from "../lexicons/types/network/cosmik/collection";
import type { Main as CollectionLink } from "../lexicons/types/network/cosmik/collectionLink";
import type { ATBookmarkItem, CollectionAssociation, DataSource, SourceFilter } from "./types";
import { EditCardModal } from "../components/editCardModal";

type CardRecord = Record & { value: Card };
type CollectionRecord = Record & { value: Collection };
type CollectionLinkRecord = Record & { value: CollectionLink };

class SembleItem implements ATBookmarkItem {
	private record: CardRecord;
	private attachedNotes: Array<{ uri: string; text: string }>;
	private collections: Array<{ uri: string; name: string }>;
	private plugin: AtmospherePlugin;

	constructor(record: CardRecord, attachedNotes: Array<{ uri: string; text: string }>, collections: Array<{ uri: string; name: string }>, plugin: AtmospherePlugin) {
		this.record = record;
		this.attachedNotes = attachedNotes;
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
		const el = container.createEl("div", { cls: "atmosphere-item-content" });

		const card = this.record.value;

		if (card.type === "NOTE") {
			const content = card.content as NoteContent;
			el.createEl("p", { text: content.text, cls: "atmosphere-semble-card-text" });
		} else if (card.type === "URL") {
			const content = card.content as UrlContent;
			const meta = content.metadata;

			if (meta?.title) {
				el.createEl("div", { text: meta.title, cls: "atmosphere-item-title" });
			}

			if (meta?.imageUrl) {
				const img = el.createEl("img", { cls: "atmosphere-item-image" });
				img.src = meta.imageUrl;
				img.alt = meta.title || "Image";
			}

			if (meta?.description) {
				const desc = meta.description.length > 200
					? meta.description.slice(0, 200) + "…"
					: meta.description;
				el.createEl("p", { text: desc, cls: "atmosphere-item-desc" });
			}

			if (meta?.siteName) {
				el.createEl("span", { text: meta.siteName, cls: "atmosphere-item-site" });
			}

			const link = el.createEl("a", {
				text: content.url,
				href: content.url,
				cls: "atmosphere-item-url",
			});
			link.setAttr("target", "_blank");
		}
	}

	renderDetail(container: HTMLElement): void {
		const body = container.createEl("div", { cls: "atmosphere-detail-body" });
		const card = this.record.value;

		if (card.type === "NOTE") {
			const content = card.content as NoteContent;
			body.createEl("p", { text: content.text, cls: "atmosphere-semble-detail-text" });
		} else if (card.type === "URL") {
			const content = card.content as UrlContent;
			const meta = content.metadata;

			if (meta?.title) {
				body.createEl("h2", { text: meta.title, cls: "atmosphere-detail-title" });
			}

			if (meta?.imageUrl) {
				const img = body.createEl("img", { cls: "atmosphere-detail-image" });
				img.src = meta.imageUrl;
				img.alt = meta.title || "Image";
			}

			if (meta?.description) {
				body.createEl("p", { text: meta.description, cls: "atmosphere-detail-description" });
			}

			if (meta?.siteName) {
				const metaGrid = body.createEl("div", { cls: "atmosphere-detail-meta" });
				const item = metaGrid.createEl("div", { cls: "atmosphere-detail-meta-item" });
				item.createEl("span", { text: "Site", cls: "atmosphere-detail-meta-label" });
				item.createEl("span", { text: meta.siteName, cls: "atmosphere-detail-meta-value" });
			}

			const linkWrapper = body.createEl("div", { cls: "atmosphere-detail-link-wrapper" });
			const link = linkWrapper.createEl("a", {
				text: content.url,
				href: content.url,
				cls: "atmosphere-detail-link",
			});
			link.setAttr("target", "_blank");
		}

	}

	getCollections(): Array<{ uri: string; name: string }> {
		return this.collections;
	}

	setCollections(collections: Array<{ uri: string; name: string }>) {
		this.collections = collections;
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

	async fetchItems(plugin: AtmospherePlugin, filteredCollections: Set<string> | undefined, _filteredTags: Set<string>): Promise<ATBookmarkItem[]> {
		const cardsResp = await getSembleCards(this.client, this.repo);
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
				return !record.value.parentCard?.uri;
			}
			return true;
		});

		if (filteredCollections !== undefined) {
			sembleCards = sembleCards.filter((card: CardRecord) => filteredCollections.has(card.uri));
		}

		return sembleCards.map((record: CardRecord) =>
			new SembleItem(record, notesMap.get(record.uri) || [], [], plugin)
		);
	}

	async getAvailableCollections(): Promise<SourceFilter[]> {
		const collectionsResp = await getSembleCollections(this.client, this.repo);
		if (!collectionsResp.ok) return [];

		const collections = collectionsResp.data.records as CollectionRecord[];
		return collections.map((c: CollectionRecord) => ({
			value: c.uri,
			label: c.value.name,
		}));
	}

	async getCollectionAssociations(): Promise<CollectionAssociation[]> {
		const linksResp = await getSembleCollectionLinks(this.client, this.repo);
		if (!linksResp.ok) return [];

		return (linksResp.data.records as CollectionLinkRecord[]).map(link => ({
			record: link.value.card.uri,
			collection: link.value.collection.uri,
		}));
	}

}

