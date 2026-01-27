import { Modal, Notice, setIcon } from "obsidian";
import type ATmarkPlugin from "../main";
import { createNoteCard, deleteRecord } from "../lib";
import type { ATmarkItem } from "../sources/types";

export class CardDetailModal extends Modal {
	plugin: ATmarkPlugin;
	item: ATmarkItem;
	onSuccess?: () => void;
	noteInput: HTMLTextAreaElement | null = null;

	constructor(plugin: ATmarkPlugin, item: ATmarkItem, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.item = item;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("semble-detail-modal");

		const header = contentEl.createEl("div", { cls: "semble-detail-header" });
		const source = this.item.getSource();
		header.createEl("span", {
			text: source,
			cls: `semble-badge semble-badge-source semble-badge-${source}`,
		});

		this.item.renderDetail(contentEl);

		// Render notes with delete buttons (semble-specific)
		if (this.item.canAddNotes() && this.item.getAttachedNotes) {
			this.renderNotesSection(contentEl);
		}

		// Add note form (only for items that support it)
		if (this.item.canAddNotes()) {
			this.renderAddNoteForm(contentEl);
		}

		const footer = contentEl.createEl("div", { cls: "semble-detail-footer" });
		footer.createEl("span", {
			text: `Created ${new Date(this.item.getCreatedAt()).toLocaleDateString()}`,
			cls: "semble-detail-date",
		});
	}

	private renderNotesSection(contentEl: HTMLElement) {
		const notes = this.item.getAttachedNotes?.();
		if (!notes || notes.length === 0) return;

		const notesSection = contentEl.createEl("div", { cls: "semble-detail-notes-section" });
		notesSection.createEl("h3", { text: "Notes", cls: "atmark-detail-section-title" });

		for (const note of notes) {
			const noteEl = notesSection.createEl("div", { cls: "semble-detail-note" });

			const noteContent = noteEl.createEl("div", { cls: "semble-detail-note-content" });
			const noteIcon = noteContent.createEl("span", { cls: "semble-detail-note-icon" });
			setIcon(noteIcon, "message-square");
			noteContent.createEl("p", { text: note.text, cls: "semble-detail-note-text" });

			const deleteBtn = noteEl.createEl("button", { cls: "semble-note-delete-btn" });
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", () => {
				void this.handleDeleteNote(note.uri);
			});
		}
	}

	private renderAddNoteForm(contentEl: HTMLElement) {
		const formSection = contentEl.createEl("div", { cls: "semble-detail-add-note" });
		formSection.createEl("h3", { text: "Add a note", cls: "atmark-detail-section-title" });

		const form = formSection.createEl("div", { cls: "semble-add-note-form" });

		this.noteInput = form.createEl("textarea", {
			cls: "atmark-textarea semble-note-input",
			attr: { placeholder: "Write a note about this item..." },
		});

		const addBtn = form.createEl("button", { text: "Add note", cls: "atmark-btn atmark-btn-primary" });
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

	onClose() {
		this.contentEl.empty();
	}
}
