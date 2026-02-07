import { Modal, Notice } from "obsidian";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import type { Main as Bookmark } from "../lexicons/types/community/lexicon/bookmarks/bookmark";
import type AtmospherePlugin from "../main";
import { putRecord, deleteRecord, getBookmarks } from "../lib";

type BookmarkRecord = Record & { value: Bookmark };

interface TagState {
	tag: string;
	isSelected: boolean;
}

export class EditBookmarkModal extends Modal {
	plugin: AtmospherePlugin;
	record: BookmarkRecord;
	onSuccess?: () => void;
	tagStates: TagState[] = [];
	newTagInput: HTMLInputElement | null = null;

	constructor(plugin: AtmospherePlugin, record: BookmarkRecord, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.record = record;
		this.onSuccess = onSuccess;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmosphere-modal");

		contentEl.createEl("h2", { text: "Edit bookmark" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const loading = contentEl.createEl("p", { text: "Loading..." });

		try {
			const bookmarksResp = await getBookmarks(this.plugin.client, this.plugin.settings.did!);
			loading.remove();

			const bookmarks = (bookmarksResp.ok ? bookmarksResp.data.records : []) as unknown as BookmarkRecord[];

			const allTags = new Set<string>();
			for (const bookmark of bookmarks) {
				if (bookmark.value.tags) {
					for (const tag of bookmark.value.tags) {
						allTags.add(tag);
					}
				}
			}

			const currentTags = new Set(this.record.value.tags || []);
			this.tagStates = Array.from(allTags).sort().map(tag => ({
				tag,
				isSelected: currentTags.has(tag),
			}));

			this.renderForm(contentEl);
		} catch (err) {
			loading.remove();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Error: ${message}`, cls: "atmosphere-error" });
		}
	}

	private renderForm(contentEl: HTMLElement) {
		const form = contentEl.createEl("div", { cls: "atmosphere-form" });

		const tagsGroup = form.createEl("div", { cls: "atmosphere-form-group" });
		tagsGroup.createEl("label", { text: "Tags" });

		const tagsList = tagsGroup.createEl("div", { cls: "atmosphere-tag-list" });
		for (const state of this.tagStates) {
			this.addTagChip(tagsList, state);
		}

		const newTagRow = tagsGroup.createEl("div", { cls: "atmosphere-tag-row" });
		this.newTagInput = newTagRow.createEl("input", {
			type: "text",
			cls: "atmosphere-input",
			attr: { placeholder: "Add new tag..." }
		});
		const addBtn = newTagRow.createEl("button", {
			text: "Add",
			cls: "atmosphere-btn atmosphere-btn-secondary",
			attr: { type: "button" }
		});
		addBtn.addEventListener("click", () => {
			const value = this.newTagInput?.value.trim();
			if (value && !this.tagStates.some(s => s.tag === value)) {
				const newState = { tag: value, isSelected: true };
				this.tagStates.push(newState);
				this.addTagChip(tagsList, newState);
				if (this.newTagInput) this.newTagInput.value = "";
			}
		});

		const actions = contentEl.createEl("div", { cls: "atmosphere-modal-actions" });

		const deleteBtn = actions.createEl("button", {
			text: "Delete",
			cls: "atmosphere-btn atmosphere-btn-danger"
		});
		deleteBtn.addEventListener("click", () => { this.confirmDelete(contentEl); });

		actions.createEl("div", { cls: "atmosphere-spacer" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "atmosphere-btn atmosphere-btn-secondary"
		});
		cancelBtn.addEventListener("click", () => { this.close(); });

		const saveBtn = actions.createEl("button", {
			text: "Save",
			cls: "atmosphere-btn atmosphere-btn-primary"
		});
		saveBtn.addEventListener("click", () => { void this.saveChanges(); });
	}

	private addTagChip(container: HTMLElement, state: TagState) {
		const item = container.createEl("label", { cls: "atmosphere-tag-item" });
		const checkbox = item.createEl("input", { type: "checkbox" });
		checkbox.checked = state.isSelected;
		checkbox.addEventListener("change", () => {
			state.isSelected = checkbox.checked;
		});
		item.createEl("span", { text: state.tag });
	}

	private confirmDelete(contentEl: HTMLElement) {
		contentEl.empty();
		contentEl.createEl("h2", { text: "Delete bookmark" });
		contentEl.createEl("p", { text: "Delete this bookmark?", cls: "atmosphere-warning-text" });

		const actions = contentEl.createEl("div", { cls: "atmosphere-modal-actions" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "atmosphere-btn atmosphere-btn-secondary"
		});
		cancelBtn.addEventListener("click", () => {
			void this.onOpen();
		});

		const confirmBtn = actions.createEl("button", {
			text: "Delete",
			cls: "atmosphere-btn atmosphere-btn-danger"
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
				contentEl.createEl("p", { text: "Invalid bookmark uri.", cls: "atmosphere-error" });
				return;
			}

			await deleteRecord(
				this.plugin.client,
				this.plugin.settings.did!,
				"community.lexicon.bookmarks.bookmark",
				rkey
			);

			new Notice("Bookmark deleted");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			contentEl.empty();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Failed to delete: ${message}`, cls: "atmosphere-error" });
		}
	}

	private async saveChanges() {
		if (!this.plugin.client) return;

		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Saving changes..." });

		try {
			const selectedTags = this.tagStates.filter(s => s.isSelected).map(s => s.tag);
			const newTag = this.newTagInput?.value.trim();
			if (newTag && !selectedTags.includes(newTag)) {
				selectedTags.push(newTag);
			}
			const tags = [...new Set(selectedTags)];

			const rkey = this.record.uri.split("/").pop();
			if (!rkey) {
				contentEl.empty();
				contentEl.createEl("p", { text: "Invalid bookmark uri.", cls: "atmosphere-error" });
				return;
			}

			const updatedRecord: Bookmark = {
				...this.record.value,
				tags,
			};

			await putRecord(
				this.plugin.client,
				this.plugin.settings.did!,
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
			contentEl.createEl("p", { text: `Failed to save: ${message}`, cls: "atmosphere-error" });
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
