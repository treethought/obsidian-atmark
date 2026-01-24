import { Modal, Notice, setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import type { Main as Card, NoteContent, UrlContent } from "../lexicons/types/network/cosmik/card";
import { createNoteCard, deleteRecord } from "../lib";

interface AttachedNote {
	uri: string;
	text: string;
}

interface CardRecord {
	uri: string;
	cid: string;
	value: Card;
}

interface CardWithNotes extends CardRecord {
	attachedNotes: AttachedNote[];
}

export class CardDetailModal extends Modal {
	plugin: ATmarkPlugin;
	card: CardWithNotes;
	onSuccess?: () => void;
	noteInput: HTMLTextAreaElement | null = null;

	constructor(plugin: ATmarkPlugin, card: CardWithNotes, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.card = card;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("semble-detail-modal");

		const card = this.card.value;

		// Header with type badge
		const header = contentEl.createEl("div", { cls: "semble-detail-header" });
		header.createEl("span", {
			text: card.type,
			cls: `semble-badge semble-badge-${card.type?.toLowerCase() || "unknown"}`,
		});

		if (card.type === "NOTE") {
			this.renderNoteCard(contentEl, card);
		} else if (card.type === "URL") {
			this.renderUrlCard(contentEl, card);
		}

		// Attached notes section
		if (this.card.attachedNotes.length > 0) {
			const notesSection = contentEl.createEl("div", { cls: "semble-detail-notes-section" });
			notesSection.createEl("h3", { text: "Notes", cls: "semble-detail-section-title" });

			for (const note of this.card.attachedNotes) {
				const noteEl = notesSection.createEl("div", { cls: "semble-detail-note" });

				const noteContent = noteEl.createEl("div", { cls: "semble-detail-note-content" });
				const noteIcon = noteContent.createEl("span", { cls: "semble-detail-note-icon" });
				setIcon(noteIcon, "message-square");
				noteContent.createEl("p", { text: note.text, cls: "semble-detail-note-text" });

				const deleteBtn = noteEl.createEl("button", { cls: "semble-note-delete-btn" });
				setIcon(deleteBtn, "trash-2");
				deleteBtn.setAttribute("aria-label", "Delete note");
				deleteBtn.addEventListener("click", () => { void this.handleDeleteNote(note.uri); });
			}
		}

		// Add note form
		this.renderAddNoteForm(contentEl);

		// Footer with date
		if (card.createdAt) {
			const footer = contentEl.createEl("div", { cls: "semble-detail-footer" });
			footer.createEl("span", {
				text: `Created ${new Date(card.createdAt).toLocaleDateString()}`,
				cls: "semble-detail-date",
			});
		}
	}

	private renderNoteCard(contentEl: HTMLElement, card: Card) {
		const content = card.content as NoteContent;
		const body = contentEl.createEl("div", { cls: "semble-detail-body" });
		body.createEl("p", { text: content.text, cls: "semble-detail-text" });
	}

	private renderUrlCard(contentEl: HTMLElement, card: Card) {
		const content = card.content as UrlContent;
		const meta = content.metadata;
		const body = contentEl.createEl("div", { cls: "semble-detail-body" });

		// Title
		if (meta?.title) {
			body.createEl("h2", { text: meta.title, cls: "semble-detail-title" });
		}

		// Image
		if (meta?.imageUrl) {
			const img = body.createEl("img", { cls: "semble-detail-image" });
			img.src = meta.imageUrl;
			img.alt = meta.title || "Image";
		}

		// Full description
		if (meta?.description) {
			body.createEl("p", { text: meta.description, cls: "semble-detail-description" });
		}

		// Metadata grid
		const metaGrid = body.createEl("div", { cls: "semble-detail-meta" });

		if (meta?.siteName) {
			this.addMetaItem(metaGrid, "Site", meta.siteName);
		}

		if (meta?.author) {
			this.addMetaItem(metaGrid, "Author", meta.author);
		}

		if (meta?.publishedDate) {
			this.addMetaItem(metaGrid, "Published", new Date(meta.publishedDate).toLocaleDateString());
		}

		if (meta?.type) {
			this.addMetaItem(metaGrid, "Type", meta.type);
		}

		if (meta?.doi) {
			this.addMetaItem(metaGrid, "DOI", meta.doi);
		}

		if (meta?.isbn) {
			this.addMetaItem(metaGrid, "ISBN", meta.isbn);
		}

		// URL link
		const linkWrapper = body.createEl("div", { cls: "semble-detail-link-wrapper" });
		const link = linkWrapper.createEl("a", {
			text: content.url,
			href: content.url,
			cls: "semble-detail-link",
		});
		link.setAttr("target", "_blank");
	}

	private renderAddNoteForm(contentEl: HTMLElement) {
		const formSection = contentEl.createEl("div", { cls: "semble-detail-add-note" });
		formSection.createEl("h3", { text: "Add a note", cls: "semble-detail-section-title" });

		const form = formSection.createEl("div", { cls: "semble-add-note-form" });

		this.noteInput = form.createEl("textarea", {
			cls: "semble-textarea semble-note-input",
			attr: { placeholder: "Write a note about this card..." },
		});

		const addBtn = form.createEl("button", { text: "Add note", cls: "semble-btn semble-btn-primary" });
		addBtn.addEventListener("click", () => { void this.handleAddNote(); });
	}

	private async handleAddNote() {
		if (!this.plugin.client || !this.noteInput) return;

		const text = this.noteInput.value.trim();
		if (!text) {
			new Notice("Please enter a note");
			return;
		}

		try {
			await createNoteCard(
				this.plugin.client,
				this.plugin.settings.identifier,
				text,
				{ uri: this.card.uri, cid: this.card.cid }
			);

			new Notice("Note added");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to add note: ${message}`);
		}
	}

	private async handleDeleteNote(noteUri: string) {
		if (!this.plugin.client) return;

		const rkey = noteUri.split("/").pop();
		if (!rkey) {
			new Notice("Invalid note uri");
			return;
		}

		try {
			await deleteRecord(
				this.plugin.client,
				this.plugin.settings.identifier,
				"network.cosmik.card",
				rkey
			);

			new Notice("Note deleted");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to delete note: ${message}`);
		}
	}

	private addMetaItem(container: HTMLElement, label: string, value: string) {
		const item = container.createEl("div", { cls: "semble-detail-meta-item" });
		item.createEl("span", { text: label, cls: "semble-detail-meta-label" });
		item.createEl("span", { text: value, cls: "semble-detail-meta-value" });
	}

	onClose() {
		this.contentEl.empty();
	}
}
