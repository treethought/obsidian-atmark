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

		void this.renderBody(contentEl);

		const collections = this.item.getCollections();
		if (collections.length > 0) {
			this.renderCollectionsSection(contentEl, collections);
		}

		if (this.item.canAddTags()) {
			this.renderTagsSection(contentEl);
		}

		if (this.item.canAddNotes() && this.item.getAttachedNotes) {
			this.renderNotesSection(contentEl);
		}

		if (this.item.canAddNotes()) {
			this.renderAddNoteForm(contentEl);
		}

		const footer = contentEl.createEl("div", { cls: "atmosphere-detail-footer" });
		const footerLeft = footer.createEl("div", { cls: "atmosphere-detail-footer-left" });
		const source = this.item.getSource();
		const sourceBadge = footerLeft.createEl("span", { cls: `atmosphere-badge atmosphere-badge-${source}` });
		setIcon(sourceBadge, sourceIconId(source));
		footerLeft.createEl("span", {
			text: `Created ${new Date(this.item.getCreatedAt()).toLocaleDateString()}`,
			cls: "atmosphere-detail-date",
		});

		if (this.item.canEdit()) {
			const editBtn = footer.createEl("button", { cls: "atmosphere-detail-edit-btn" });
			setIcon(editBtn, "pencil");
			editBtn.addEventListener("click", () => {
				this.close();
				this.item.openEditModal(this.onSuccess);
			});
		}
	}

	private async renderBody(contentEl: HTMLElement) {
		const body = contentEl.createEl("div", { cls: "atmosphere-detail-body" });

		const title = this.item.getTitle();
		if (title) {
			body.createEl("h2", { text: title, cls: "atmosphere-detail-title" });
		}

		const imageUrl = await this.item.getImageUrl();
		if (imageUrl) {
			const img = body.createEl("img", { cls: "atmosphere-detail-image" });
			img.src = imageUrl;
			img.alt = title || "Image";
		}

		const description = this.item.getDescription();
		if (description) {
			body.createEl("p", { text: description, cls: "atmosphere-detail-description" });
		}

		const siteName = this.item.getSiteName();
		if (siteName) {
			const metaGrid = body.createEl("div", { cls: "atmosphere-detail-meta" });
			const metaItem = metaGrid.createEl("div", { cls: "atmosphere-detail-meta-item" });
			metaItem.createEl("span", { text: "Site", cls: "atmosphere-detail-meta-label" });
			metaItem.createEl("span", { text: siteName, cls: "atmosphere-detail-meta-value" });
		}

		const url = this.item.getUrl();
		if (url) {
			const linkWrapper = body.createEl("div", { cls: "atmosphere-detail-link-wrapper" });
			const link = linkWrapper.createEl("a", {
				text: url,
				href: url,
				cls: "atmosphere-detail-link",
			});
			link.setAttr("target", "_blank");
		}
	}

	private renderTagsSection(contentEl: HTMLElement) {
		const tags = this.item.getTags();
		if (tags.length === 0) return;
		const section = contentEl.createEl("div", { cls: "atmosphere-detail-tags" });
		section.createEl("h3", { text: "Tags", cls: "atmosphere-detail-section-title" });
		const container = section.createEl("div", { cls: "atmosphere-item-tags" });
		for (const tag of tags) {
			container.createEl("span", { text: tag, cls: "atmosphere-tag" });
		}
	}

	private renderCollectionsSection(contentEl: HTMLElement, collections: Array<{ uri: string; name: string; source: string }>) {
		const section = contentEl.createEl("div", { cls: "atmosphere-detail-collections" });
		section.createEl("span", { text: "In collections", cls: "atmosphere-detail-collections-label" });
		const badges = section.createEl("div", { cls: "atmosphere-detail-collections-badges" });
		for (const collection of collections) {
			const badge = badges.createEl("span", { cls: "atmosphere-collection" });
			const iconEl = badge.createEl("span", { cls: "atmosphere-collection-source-icon" });
			setIcon(iconEl, sourceIconId(collection.source as "semble" | "bookmark" | "margin"));
			badge.createEl("span", { text: collection.name });
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

function sourceIconId(source: "semble" | "bookmark" | "margin"): string {
	if (source === "semble") return "atmosphere-semble";
	if (source === "margin") return "atmosphere-margin";
	return "bookmark";
}
