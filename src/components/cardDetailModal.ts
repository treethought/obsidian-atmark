import { Modal, Notice } from "obsidian";
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

		// Header with source badge
		const header = contentEl.createEl("div", { cls: "semble-detail-header" });
		const source = this.item.getSource();
		header.createEl("span", {
			text: source,
			cls: `semble-badge semble-badge-source semble-badge-${source}`,
		});

		// Render item detail content
		this.item.renderDetail(contentEl);

		// Add note form (only for items that support it)
		if (this.item.canAddNotes()) {
			this.renderAddNoteForm(contentEl);
		}

		// Footer with date
		const footer = contentEl.createEl("div", { cls: "semble-detail-footer" });
		footer.createEl("span", {
			text: `Created ${new Date(this.item.getCreatedAt()).toLocaleDateString()}`,
			cls: "semble-detail-date",
		});
	}

	private renderAddNoteForm(contentEl: HTMLElement) {
		const formSection = contentEl.createEl("div", { cls: "semble-detail-add-note" });
		formSection.createEl("h3", { text: "Add a note", cls: "semble-detail-section-title" });

		const form = formSection.createEl("div", { cls: "semble-add-note-form" });

		this.noteInput = form.createEl("textarea", {
			cls: "semble-textarea semble-note-input",
			attr: { placeholder: "Write a note about this item..." },
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
