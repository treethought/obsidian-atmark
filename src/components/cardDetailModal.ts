import { Modal, Notice, setIcon } from "obsidian";
import type AtmospherePlugin from "../main";
import { createSembleNote, deleteRecord } from "../lib";
import type { ATBookmarkItem } from "../sources/types";

export class CardDetailModal extends Modal {
	plugin: AtmospherePlugin;
	item: ATBookmarkItem;
	onSuccess?: () => void;
	noteInput: HTMLTextAreaElement | null = null;

	constructor(plugin: AtmospherePlugin, item: ATBookmarkItem, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.item = item;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmosphere-detail-modal");

		const header = contentEl.createEl("div", { cls: "atmosphere-detail-header" });
		const source = this.item.getSource();
		header.createEl("span", {
			text: source,
			cls: `atmosphere-badge atmosphere-badge-source atmosphere-badge-${source}`,
		});

		this.item.renderDetail(contentEl);

		const collections = this.item.getCollections();
		if (collections.length > 0) {
			this.renderCollectionsSection(contentEl, collections);
		}

		// semble
		if (this.item.canAddNotes() && this.item.getAttachedNotes) {
			this.renderNotesSection(contentEl);
		}

		if (this.item.canAddNotes()) {
			this.renderAddNoteForm(contentEl);
		}

		const footer = contentEl.createEl("div", { cls: "atmosphere-detail-footer" });
		footer.createEl("span", {
			text: `Created ${new Date(this.item.getCreatedAt()).toLocaleDateString()}`,
			cls: "atmosphere-detail-date",
		});
	}

	private renderCollectionsSection(contentEl: HTMLElement, collections: Array<{ uri: string; name: string }>) {
		const section = contentEl.createEl("div", { cls: "atmosphere-detail-collections" });
		section.createEl("span", { text: "In collections", cls: "atmosphere-detail-collections-label" });
		const badges = section.createEl("div", { cls: "atmosphere-detail-collections-badges" });
		for (const collection of collections) {
			badges.createEl("span", { text: collection.name, cls: "atmosphere-collection" });
		}
	}

	private renderNotesSection(contentEl: HTMLElement) {
		const notes = this.item.getAttachedNotes?.();
		if (!notes || notes.length === 0) return;

		const notesSection = contentEl.createEl("div", { cls: "atmosphere-semble-detail-notes-section" });
		notesSection.createEl("h3", { text: "Notes", cls: "atmosphere-detail-section-title" });

		for (const note of notes) {
			const noteEl = notesSection.createEl("div", { cls: "atmosphere-semble-detail-note" });

			const noteContent = noteEl.createEl("div", { cls: "atmosphere-semble-detail-note-content" });
			const noteIcon = noteContent.createEl("span", { cls: "atmosphere-semble-detail-note-icon" });
			setIcon(noteIcon, "message-square");
			noteContent.createEl("p", { text: note.text, cls: "atmosphere-semble-detail-note-text" });

			const deleteBtn = noteEl.createEl("button", { cls: "atmosphere-semble-note-delete-btn" });
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", () => {
				void this.handleDeleteNote(note.uri);
			});
		}
	}

	private renderAddNoteForm(contentEl: HTMLElement) {
		const formSection = contentEl.createEl("div", { cls: "atmosphere-semble-detail-add-note" });
		formSection.createEl("h3", { text: "Add a note", cls: "atmosphere-detail-section-title" });

		const form = formSection.createEl("div", { cls: "atmosphere-semble-add-note-form" });

		this.noteInput = form.createEl("textarea", {
			cls: "atmosphere-textarea atmosphere-semble-note-input",
			attr: { placeholder: "Write a note about this item..." },
		});

		const addBtn = form.createEl("button", { text: "Add note", cls: "atmosphere-btn atmosphere-btn-primary" });
		addBtn.addEventListener("click", () => { void this.handleAddNote(); });
	}

	private async handleAddNote() {
		if (!this.plugin.client.loggedIn || !this.noteInput) return;

		const text = this.noteInput.value.trim();
		if (!text) {
			new Notice("Please enter a note");
			return;
		}

		try {
			await createSembleNote(
				this.plugin.client,
				this.plugin.settings.did!,
				text,
				{ uri: this.item.getUri(), cid: this.item.getCid() }
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
		if (!this.plugin.client.loggedIn) return;

		const rkey = noteUri.split("/").pop();
		if (!rkey) {
			new Notice("Invalid note uri");
			return;
		}

		try {
			await deleteRecord(
				this.plugin.client,
				this.plugin.settings.did!,
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

	onClose() {
		this.contentEl.empty();
	}
}
