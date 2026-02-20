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
	private collections: Array<{ uri: string; name: string; source: string }>;
	private plugin: AtmospherePlugin;

	constructor(record: CardRecord, attachedNotes: Array<{ uri: string; text: string }>, collections: Array<{ uri: string; name: string; source: string }>, plugin: AtmospherePlugin) {
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

	canAddTags(): boolean {
		return false;
	}

	canEdit(): boolean {
		return true;
	}

	openEditModal(onSuccess?: () => void): void {
		new EditCardModal(this.plugin, this.record.uri, this.record.cid, onSuccess).open();
	}

	getTitle(): string | undefined {
		const card = this.record.value;
		if (card.type === "URL") {
			return (card.content as UrlContent).metadata?.title || undefined;
		}
		return undefined;
	}

	getDescription(): string | undefined {
		const card = this.record.value;
		if (card.type === "NOTE") {
			return (card.content as NoteContent).text;
		} else if (card.type === "URL") {
			return (card.content as UrlContent).metadata?.description || undefined;
		}
		return undefined;
	}

	getImageUrl(): string | undefined {
		const card = this.record.value;
		if (card.type === "URL") {
			return (card.content as UrlContent).metadata?.imageUrl || undefined;
		}
		return undefined;
	}

	getUrl(): string | undefined {
		const card = this.record.value;
		if (card.type === "URL") {
			return (card.content as UrlContent).url;
		}
		return undefined;
	}

	getSiteName(): string | undefined {
		const card = this.record.value;
		if (card.type === "URL") {
			return (card.content as UrlContent).metadata?.siteName || undefined;
		}
		return undefined;
	}

	getTags(): string[] {
		return [];
	}

	getCollections(): Array<{ uri: string; name: string; source: string }> {
		return this.collections;
	}

	setCollections(collections: Array<{ uri: string; name: string; source: string }>) {
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

		if (filteredCollections.size > 0) {
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

