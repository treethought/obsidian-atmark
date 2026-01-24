import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import { getCollections, getCollectionLinks, getCards } from "../lib";
import type { Main as Card, NoteContent, UrlContent } from "../lexicons/types/network/cosmik/card";
import type { Main as CollectionLink } from "../lexicons/types/network/cosmik/collectionLink";
import type { Main as Collection } from "../lexicons/types/network/cosmik/collection";
import { VIEW_TYPE_SEMBLE_COLLECTIONS } from "./collections";
import { renderProfileIcon } from "../components/profileIcon";
import { EditCardModal } from "../components/editCardModal";
import { CardDetailModal } from "../components/cardDetailModal";

export const VIEW_TYPE_SEMBLE_CARDS = "semble-cards-view";

interface CardRecord {
	uri: string;
	cid: string;
	value: Card;
}

export interface AttachedNote {
	uri: string;
	text: string;
}

export interface CardWithNotes extends CardRecord {
	attachedNotes: AttachedNote[];
}

interface CollectionLinkRecord {
	uri: string;
	value: CollectionLink;
}

interface CollectionRecord {
	uri: string;
	value: Collection;
}

export class SembleCardsView extends ItemView {
	plugin: ATmarkPlugin;
	collectionUri: string | null = null;
	collectionName: string = "All Cards";

	constructor(leaf: WorkspaceLeaf, plugin: ATmarkPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_SEMBLE_CARDS;
	}

	getDisplayText() {
		return this.collectionName;
	}

	getIcon() {
		return "layers";
	}

	setCollection(uri: string | null, name: string) {
		this.collectionUri = uri;
		this.collectionName = name;
		void this.render();
	}

	async onOpen() {
		await this.render();
	}

	/**
	 * Process cards to attach notes to their parent cards and filter out attached notes.
	 * Notes with originalCard or parentCard references are attached to those cards
	 * instead of being shown as separate cards.
	 */
	private processCardsWithNotes(cards: CardRecord[]): CardWithNotes[] {
		// Build a map of card URI -> attached notes with their URIs
		const notesMap = new Map<string, AttachedNote[]>();

		// Find all NOTE cards that reference other cards
		for (const record of cards) {
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
		const filteredCards = cards.filter((record) => {
			if (record.value.type === "NOTE") {
				const hasParent = record.value.originalCard?.uri || record.value.parentCard?.uri;
				return !hasParent; // Only keep standalone notes
			}
			return true;
		});

		// Add attached notes to each card
		return filteredCards.map((record) => ({
			...record,
			attachedNotes: notesMap.get(record.uri) || [],
		}));
	}

	async getAllCards(): Promise<CardWithNotes[]> {
		if (!this.plugin.client) return [];

		const repo = this.plugin.settings.identifier;
		const cardsResp = await getCards(this.plugin.client, repo);
		if (!cardsResp.ok) return [];
		const cards = cardsResp.data.records as unknown as CardRecord[];
		return this.processCardsWithNotes(cards);
	}

	async getCardsInCollection(collectionUri: string): Promise<CardWithNotes[]> {
		if (!this.plugin.client) return [];

		const repo = this.plugin.settings.identifier;
		const [linksResp, cardsResp] = await Promise.all([
			getCollectionLinks(this.plugin.client, repo),
			getCards(this.plugin.client, repo),
		]);

		if (!linksResp.ok || !cardsResp.ok) return [];
		const allLinks = linksResp.data.records as unknown as CollectionLinkRecord[];
		const allCards = cardsResp.data.records as unknown as CardRecord[];

		// Filter links by collection
		const links = allLinks.filter((link) => link.value.collection.uri === collectionUri);

		// Get cards in collection
		const cardUris = new Set(links.map((link) => String(link.value.card.uri)));
		const cards = allCards.filter((card) => cardUris.has(String(card.uri)));

		return this.processCardsWithNotes(cards);
	}

	async render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("semble-cards-view");

		if (!this.plugin.client) {
			container.createEl("p", { text: "Not connected." });
			return;
		}

		const loading = container.createEl("p", { text: "Loading..." });

		try {

			let cards: CardWithNotes[] = [];
			try {
				if (this.collectionUri) {
					cards = await this.getCardsInCollection(this.collectionUri);
				} else {
					cards = await this.getAllCards();
				}
			} catch (err) {
				loading.remove();
				const message = err instanceof Error ? err.message : String(err);
				container.createEl("p", { text: `Failed to load cards: ${message}`, cls: "semble-error" });
				return;
			}

			const collectionsResp = await getCollections(this.plugin.client, this.plugin.settings.identifier);
			if (!collectionsResp.ok) {
				loading.remove();
				const errorMsg = collectionsResp.data?.error ? String(collectionsResp.data.error) : "Unknown error";
				container.createEl("p", { text: `Failed to load collections: ${errorMsg}`, cls: "semble-error" });
				return;
			}
			const collections = collectionsResp.data?.records as unknown as CollectionRecord[];

			loading.remove();

			// Render header with back button and filters
			this.renderHeader(container, collections);

			if (cards.length === 0) {
				container.createEl("p", { text: "No cards found." });
				return;
			}

			const grid = container.createEl("div", { cls: "semble-card-grid" });
			for (const record of cards) {
				try {
					this.renderCard(grid, record);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(`Failed to render card ${record.uri}: ${message}`);
				}
			}
		} catch (err) {
			loading.remove();
			const message = err instanceof Error ? err.message : String(err);
			container.createEl("p", { text: `Failed to load: ${message}`, cls: "semble-error" });
		}
	}

	private renderHeader(container: HTMLElement, collections: CollectionRecord[]) {
		const header = container.createEl("div", { cls: "semble-page-header" });

		const nav = header.createEl("div", { cls: "semble-nav-row" });

		// Back button
		const backBtn = nav.createEl("button", { cls: "semble-back-btn" });
		setIcon(backBtn, "arrow-left");
		backBtn.addEventListener("click", () => {
			void this.plugin.activateView(VIEW_TYPE_SEMBLE_COLLECTIONS);
		});

		nav.createEl("span", { text: "Semble", cls: "semble-brand" });

		renderProfileIcon(nav, this.plugin.profile);

		header.createEl("h2", { text: this.collectionName, cls: "semble-page-title" });

		// Filter chips
		const filters = container.createEl("div", { cls: "semble-filter-chips" });

		// All chip
		const allChip = filters.createEl("button", {
			text: "All",
			cls: `semble-chip ${!this.collectionUri ? "semble-chip-active" : ""}`,
		});
		allChip.addEventListener("click", () => {
			this.setCollection(null, "All Cards");
		});

		// Collection chips
		for (const record of collections) {
			const chip = filters.createEl("button", {
				text: record.value.name,
				cls: `semble-chip ${this.collectionUri === record.uri ? "semble-chip-active" : ""}`,
			});
			chip.addEventListener("click", () => {
				this.setCollection(record.uri, record.value.name);
			});
		}
	}

	private renderCard(container: HTMLElement, record: CardWithNotes) {
		const card = record.value;
		const el = container.createEl("div", { cls: "semble-card" });

		// Open detail modal on click
		el.addEventListener("click", () => {
			new CardDetailModal(this.plugin, record, () => {
				void this.render();
			}).open();
		});

		const header = el.createEl("div", { cls: "semble-card-header" });
		header.createEl("span", {
			text: card.type,
			cls: `semble-badge semble-badge-${card.type?.toLowerCase() || "unknown"}`,
		});

		const addBtn = header.createEl("button", { cls: "semble-card-menu-btn" });
		setIcon(addBtn, "more-vertical");
		addBtn.setAttribute("aria-label", "Manage collections");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new EditCardModal(this.plugin, record.uri, record.cid, () => {
				void this.render();
			}).open();
		});

		// Display attached notes at the top of the card
		if (record.attachedNotes.length > 0) {
			for (const note of record.attachedNotes) {
				el.createEl("p", { text: note.text, cls: "semble-card-note" });
			}
		}

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
				img.alt = meta.title || "Image for " + content.url;
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

		const footer = el.createEl("div", { cls: "semble-card-footer" });
		if (card.createdAt) {
			footer.createEl("span", {
				text: new Date(card.createdAt).toLocaleDateString(),
				cls: "semble-card-date",
			});
		}
	}

	async onClose() { }
}
