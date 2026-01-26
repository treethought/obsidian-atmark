import { Modal, Notice } from "obsidian";
import type ATmarkPlugin from "../main";
import { putRecord, deleteRecord } from "../lib";

export class EditBookmarkModal extends Modal {
	plugin: ATmarkPlugin;
	record: any;
	onSuccess?: () => void;
	tagInputs: HTMLInputElement[] = [];

	constructor(plugin: ATmarkPlugin, record: any, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.record = record;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("semble-collection-modal");

		contentEl.createEl("h2", { text: "Edit bookmark tags" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const existingTags = this.record.value.tags || [];

		const form = contentEl.createEl("div", { cls: "semble-form" });

		// Tags section
		const tagsGroup = form.createEl("div", { cls: "semble-form-group" });
		tagsGroup.createEl("label", { text: "Tags" });

		const tagsContainer = tagsGroup.createEl("div", { cls: "semble-tags-container" });

		// Render existing tags
		for (const tag of existingTags) {
			this.addTagInput(tagsContainer, tag);
		}

		// Add empty input for new tag
		this.addTagInput(tagsContainer, "");

		// Add tag button
		const addTagBtn = tagsGroup.createEl("button", {
			text: "+ Add tag",
			cls: "semble-btn semble-btn-secondary"
		});
		addTagBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.addTagInput(tagsContainer, "");
		});

		// Action buttons
		const actions = contentEl.createEl("div", { cls: "semble-modal-actions" });

		const deleteBtn = actions.createEl("button", {
			text: "Delete",
			cls: "semble-btn semble-btn-danger"
		});
		deleteBtn.addEventListener("click", () => { this.confirmDelete(contentEl); });

		actions.createEl("div", { cls: "semble-spacer" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "semble-btn semble-btn-secondary"
		});
		cancelBtn.addEventListener("click", () => { this.close(); });

		const saveBtn = actions.createEl("button", {
			text: "Save",
			cls: "semble-btn semble-btn-primary"
		});
		saveBtn.addEventListener("click", () => { void this.saveChanges(); });
	}

	private addTagInput(container: HTMLElement, value: string) {
		const tagRow = container.createEl("div", { cls: "semble-tag-row" });

		const input = tagRow.createEl("input", {
			type: "text",
			cls: "semble-input",
			value,
			attr: { placeholder: "Enter tag..." }
		});
		this.tagInputs.push(input);

		const removeBtn = tagRow.createEl("button", {
			text: "×",
			cls: "semble-btn semble-btn-secondary semble-tag-remove-btn"
		});
		removeBtn.addEventListener("click", (e) => {
			e.preventDefault();
			tagRow.remove();
			this.tagInputs = this.tagInputs.filter(i => i !== input);
		});
	}

	private confirmDelete(contentEl: HTMLElement) {
		contentEl.empty();
		contentEl.createEl("h2", { text: "Delete bookmark" });
		contentEl.createEl("p", { text: "Delete this bookmark?", cls: "semble-warning-text" });

		const actions = contentEl.createEl("div", { cls: "semble-modal-actions" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "semble-btn semble-btn-secondary"
		});
		cancelBtn.addEventListener("click", () => {
			void this.onOpen();
		});

		const confirmBtn = actions.createEl("button", {
			text: "Delete",
			cls: "semble-btn semble-btn-danger"
		});
		confirmBtn.addEventListener("click", () => { void this.deleteBookmark(); });
	}

	private async deleteBookmark() {
		if (!this.plugin.client) return;

		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Deleting bookmark..." });

		try {
			const rkey = this.record.uri.split("/").pop();
			if (!rkey) {
				contentEl.empty();
				contentEl.createEl("p", { text: "Invalid bookmark uri.", cls: "semble-error" });
				return;
			}

			await deleteRecord(
				this.plugin.client,
				this.plugin.settings.identifier,
				"community.lexicon.bookmarks.bookmark",
				rkey
			);

			new Notice("Bookmark deleted");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			contentEl.empty();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Failed to delete: ${message}`, cls: "semble-error" });
		}
	}

	private async saveChanges() {
		if (!this.plugin.client) return;

		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Saving changes..." });

		try {
			// Get non-empty unique tags
			const tags = [...new Set(
				this.tagInputs
					.map(input => input.value.trim())
					.filter(tag => tag.length > 0)
			)];

			const rkey = this.record.uri.split("/").pop();
			if (!rkey) {
				contentEl.empty();
				contentEl.createEl("p", { text: "Invalid bookmark uri.", cls: "semble-error" });
				return;
			}

			// Update the record with new tags
			const updatedRecord = {
				...this.record.value,
				tags,
			};

			await putRecord(
				this.plugin.client,
				this.plugin.settings.identifier,
				"community.lexicon.bookmarks.bookmark",
				rkey,
				updatedRecord
			);

			new Notice("Tags updated");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			contentEl.empty();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Failed to save: ${message}`, cls: "semble-error" });
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
