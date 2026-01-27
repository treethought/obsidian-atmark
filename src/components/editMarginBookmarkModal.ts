import { Modal, Notice } from "obsidian";
import type { Record } from "@atcute/atproto/types/repo/listRecords";
import type { Main as MarginBookmark } from "../lexicons/types/at/margin/bookmark";
import type { Main as MarginCollection } from "../lexicons/types/at/margin/collection";
import type { Main as MarginCollectionItem } from "../lexicons/types/at/margin/collectionItem";
import type ATmarkPlugin from "../main";
import { putRecord, deleteRecord, getMarginCollections, getMarginCollectionItems, createMarginCollectionItem, getMarginBookmarks } from "../lib";

type MarginBookmarkRecord = Record & { value: MarginBookmark };
type MarginCollectionRecord = Record & { value: MarginCollection };
type MarginCollectionItemRecord = Record & { value: MarginCollectionItem };

interface CollectionState {
	collection: MarginCollectionRecord;
	isSelected: boolean;
	wasSelected: boolean;
	linkUri?: string;
}

interface TagState {
	tag: string;
	isSelected: boolean;
}

export class EditMarginBookmarkModal extends Modal {
	plugin: ATmarkPlugin;
	record: MarginBookmarkRecord;
	onSuccess?: () => void;
	tagStates: TagState[] = [];
	newTagInput: HTMLInputElement | null = null;
	collectionStates: CollectionState[] = [];

	constructor(plugin: ATmarkPlugin, record: MarginBookmarkRecord, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.record = record;
		this.onSuccess = onSuccess;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmark-modal");

		contentEl.createEl("h2", { text: "Edit margin bookmark" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const loading = contentEl.createEl("p", { text: "Loading..." });

		try {
			const [collectionsResp, itemsResp, bookmarksResp] = await Promise.all([
				getMarginCollections(this.plugin.client, this.plugin.settings.identifier),
				getMarginCollectionItems(this.plugin.client, this.plugin.settings.identifier),
				getMarginBookmarks(this.plugin.client, this.plugin.settings.identifier),
			]);

			loading.remove();

			const collections = (collectionsResp.ok ? collectionsResp.data.records : []) as unknown as MarginCollectionRecord[];
			const items = (itemsResp.ok ? itemsResp.data.records : []) as unknown as MarginCollectionItemRecord[];
			const bookmarks = (bookmarksResp.ok ? bookmarksResp.data.records : []) as unknown as MarginBookmarkRecord[];

			const bookmarkLinks = items.filter(item => item.value.annotation === this.record.uri);
			const linkedCollectionUris = new Map<string, string>();
			for (const link of bookmarkLinks) {
				linkedCollectionUris.set(link.value.collection, link.uri);
			}

			this.collectionStates = collections.map(collection => ({
				collection,
				isSelected: linkedCollectionUris.has(collection.uri),
				wasSelected: linkedCollectionUris.has(collection.uri),
				linkUri: linkedCollectionUris.get(collection.uri),
			}));

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
			contentEl.createEl("p", { text: `Error: ${message}`, cls: "atmark-error" });
		}
	}

	private renderForm(contentEl: HTMLElement) {
		const form = contentEl.createEl("div", { cls: "atmark-form" });

		const tagsGroup = form.createEl("div", { cls: "atmark-form-group" });
		tagsGroup.createEl("label", { text: "Tags" });

		const tagsList = tagsGroup.createEl("div", { cls: "atmark-tag-list" });
		for (const state of this.tagStates) {
			this.addTagChip(tagsList, state);
		}

		const newTagRow = tagsGroup.createEl("div", { cls: "atmark-tag-row" });
		this.newTagInput = newTagRow.createEl("input", {
			type: "text",
			cls: "atmark-input",
			attr: { placeholder: "Add new tag..." }
		});
		const addBtn = newTagRow.createEl("button", {
			text: "Add",
			cls: "atmark-btn atmark-btn-secondary",
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

		if (this.collectionStates.length > 0) {
			const collectionsGroup = form.createEl("div", { cls: "atmark-form-group" });
			collectionsGroup.createEl("label", { text: "Collections" });

			const collectionsList = collectionsGroup.createEl("div", { cls: "atmark-collection-list" });

			for (const state of this.collectionStates) {
				const item = collectionsList.createEl("label", { cls: "atmark-collection-item" });

				const checkbox = item.createEl("input", { type: "checkbox", cls: "atmark-collection-checkbox" });
				checkbox.checked = state.isSelected;
				checkbox.addEventListener("change", () => {
					state.isSelected = checkbox.checked;
				});

				const info = item.createEl("div", { cls: "atmark-collection-item-info" });
				info.createEl("span", { text: state.collection.value.name, cls: "atmark-collection-item-name" });
				if (state.collection.value.description) {
					info.createEl("span", { text: state.collection.value.description, cls: "atmark-collection-item-desc" });
				}
			}
		}

		const actions = contentEl.createEl("div", { cls: "atmark-modal-actions" });

		const deleteBtn = actions.createEl("button", {
			text: "Delete",
			cls: "atmark-btn atmark-btn-danger"
		});
		deleteBtn.addEventListener("click", () => { this.confirmDelete(contentEl); });

		actions.createEl("div", { cls: "atmark-spacer" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "atmark-btn atmark-btn-secondary"
		});
		cancelBtn.addEventListener("click", () => { this.close(); });

		const saveBtn = actions.createEl("button", {
			text: "Save",
			cls: "atmark-btn atmark-btn-primary"
		});
		saveBtn.addEventListener("click", () => { void this.saveChanges(); });
	}

	private addTagChip(container: HTMLElement, state: TagState) {
		const item = container.createEl("label", { cls: "atmark-tag-item" });
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
		contentEl.createEl("p", { text: "Delete this bookmark?", cls: "atmark-warning-text" });

		const actions = contentEl.createEl("div", { cls: "atmark-modal-actions" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "atmark-btn atmark-btn-secondary"
		});
		cancelBtn.addEventListener("click", () => {
			void this.onOpen();
		});

		const confirmBtn = actions.createEl("button", {
			text: "Delete",
			cls: "atmark-btn atmark-btn-danger"
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
				contentEl.createEl("p", { text: "Invalid bookmark uri.", cls: "atmark-error" });
				return;
			}

			await deleteRecord(
				this.plugin.client,
				this.plugin.settings.identifier,
				"at.margin.bookmark",
				rkey
			);

			new Notice("Bookmark deleted");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			contentEl.empty();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Failed to delete: ${message}`, cls: "atmark-error" });
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
				contentEl.createEl("p", { text: "Invalid bookmark uri.", cls: "atmark-error" });
				return;
			}

			const updatedRecord: MarginBookmark = {
				...this.record.value,
				tags,
			};

			await putRecord(
				this.plugin.client,
				this.plugin.settings.identifier,
				"at.margin.bookmark",
				rkey,
				updatedRecord
			);

			const collectionsToAdd = this.collectionStates.filter(s => s.isSelected && !s.wasSelected);
			const collectionsToRemove = this.collectionStates.filter(s => !s.isSelected && s.wasSelected);

			for (const state of collectionsToRemove) {
				if (state.linkUri) {
					const linkRkey = state.linkUri.split("/").pop();
					if (linkRkey) {
						await deleteRecord(
							this.plugin.client,
							this.plugin.settings.identifier,
							"at.margin.collectionItem",
							linkRkey
						);
					}
				}
			}

			for (const state of collectionsToAdd) {
				await createMarginCollectionItem(
					this.plugin.client,
					this.plugin.settings.identifier,
					this.record.uri,
					state.collection.uri
				);
			}

			const messages: string[] = [];
			if (tags.length !== (this.record.value.tags?.length || 0) ||
				!tags.every(t => this.record.value.tags?.includes(t))) {
				messages.push("Tags updated");
			}
			if (collectionsToAdd.length > 0) {
				messages.push(`Added to ${collectionsToAdd.length} collection${collectionsToAdd.length > 1 ? "s" : ""}`);
			}
			if (collectionsToRemove.length > 0) {
				messages.push(`Removed from ${collectionsToRemove.length} collection${collectionsToRemove.length > 1 ? "s" : ""}`);
			}

			new Notice(messages.length > 0 ? messages.join(". ") : "Saved");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			contentEl.empty();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Failed to save: ${message}`, cls: "atmark-error" });
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
