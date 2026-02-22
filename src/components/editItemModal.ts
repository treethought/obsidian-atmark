import { Modal, Notice, setIcon } from "obsidian";
import type AtmospherePlugin from "../main";
import type { ATBookmarkItem, DataSource } from "../sources/types";
import { SembleSource } from "../sources/semble";
import { MarginSource } from "../sources/margin";
import { BookmarkSource } from "../sources/community";

interface CollectionState {
	uri: string;
	name: string;
	description?: string;
	source: "semble" | "margin";
	isSelected: boolean;
	wasSelected: boolean;
	linkUri?: string;
}

interface TagState {
	tag: string;
	isSelected: boolean;
}

export class EditItemModal extends Modal {
	plugin: AtmospherePlugin;
	item: ATBookmarkItem;
	onSuccess?: () => void;
	collectionStates: CollectionState[] = [];
	tagStates: TagState[] = [];
	newTagInput: HTMLInputElement | null = null;
	private sembleSource!: SembleSource;
	private marginSource!: MarginSource;
	private itemSource!: DataSource;

	constructor(plugin: AtmospherePlugin, item: ATBookmarkItem, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.item = item;
		this.onSuccess = onSuccess;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmosphere-modal");
		contentEl.createEl("h2", { text: "Edit item" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const loading = contentEl.createEl("p", { text: "Loading..." });

		try {
			const did = this.plugin.settings.did!;
			this.sembleSource = new SembleSource(this.plugin.client, did);
			this.marginSource = new MarginSource(this.plugin.client, did);
			const itemSourceName = this.item.getSource();
			this.itemSource = itemSourceName === "semble" ? this.sembleSource
				: itemSourceName === "margin" ? this.marginSource
				: new BookmarkSource(this.plugin.client, did);

			const itemUri = this.item.getUri();

			const canCollect = this.item.canAddToCollections();
			const [sembleColls, sembleAssocs, marginColls, marginAssocs, availableTags] = await Promise.all([
				canCollect ? this.sembleSource.getAvailableCollections() : Promise.resolve([]),
				canCollect ? this.sembleSource.getCollectionAssociations() : Promise.resolve([]),
				canCollect ? this.marginSource.getAvailableCollections() : Promise.resolve([]),
				canCollect ? this.marginSource.getCollectionAssociations() : Promise.resolve([]),
				this.itemSource.getAvilableTags?.() ?? Promise.resolve(undefined),
			]);

			loading.remove();

			if (canCollect) {
				const sembleLinkedUris = new Map<string, string>();
				for (const assoc of sembleAssocs) {
					if (assoc.record === itemUri) sembleLinkedUris.set(assoc.collection, assoc.linkUri);
				}

				const marginLinkedUris = new Map<string, string>();
				for (const assoc of marginAssocs) {
					if (assoc.record === itemUri) marginLinkedUris.set(assoc.collection, assoc.linkUri);
				}

				this.collectionStates = [
					...sembleColls.map(c => ({
						uri: c.value,
						name: c.label ?? c.value,
						description: c.description,
						source: "semble" as const,
						isSelected: sembleLinkedUris.has(c.value),
						wasSelected: sembleLinkedUris.has(c.value),
						linkUri: sembleLinkedUris.get(c.value),
					})),
					...marginColls.map(c => ({
						uri: c.value,
						name: c.label ?? c.value,
						description: c.description,
						source: "margin" as const,
						isSelected: marginLinkedUris.has(c.value),
						wasSelected: marginLinkedUris.has(c.value),
						linkUri: marginLinkedUris.get(c.value),
					})),
				];
			}

			if (this.item.canAddTags() && availableTags) {
				const currentTags = new Set(this.item.getTags());
				this.tagStates = availableTags.map(f => f.value).sort().map(tag => ({
					tag,
					isSelected: currentTags.has(tag),
				}));
			}

			this.renderForm(contentEl);
		} catch (err) {
			loading.remove();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Error: ${message}`, cls: "atmosphere-error" });
		}
	}

	private renderForm(contentEl: HTMLElement) {
		const form = contentEl.createEl("div", { cls: "atmosphere-form" });

		if (this.item.canAddTags()) {
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
				attr: { placeholder: "Add new tag..." },
			});
			const addBtn = newTagRow.createEl("button", {
				text: "Add",
				cls: "atmosphere-btn atmosphere-btn-secondary",
				attr: { type: "button" },
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
		}

		if (this.collectionStates.length > 0) {
			const collectionsGroup = form.createEl("div", { cls: "atmosphere-form-group" });
			collectionsGroup.createEl("label", { text: "Collections" });

			const collectionsList = collectionsGroup.createEl("div", { cls: "atmosphere-collection-list" });
			for (const state of this.collectionStates) {
				const item = collectionsList.createEl("label", { cls: "atmosphere-collection-item" });

				const checkbox = item.createEl("input", { type: "checkbox", cls: "atmosphere-collection-checkbox" });
				checkbox.checked = state.isSelected;
				checkbox.addEventListener("change", () => { state.isSelected = checkbox.checked; });

				const info = item.createEl("div", { cls: "atmosphere-collection-item-info" });
				info.createEl("span", { text: state.name, cls: "atmosphere-collection-item-name" });
				if (state.description) {
					info.createEl("span", { text: state.description, cls: "atmosphere-collection-item-desc" });
				}

				const sourceIcon = item.createEl("span", { cls: "atmosphere-collection-source-icon" });
				setIcon(sourceIcon, state.source === "semble" ? "atmosphere-semble" : "atmosphere-margin");
			}
		}

		const actions = contentEl.createEl("div", { cls: "atmosphere-modal-actions" });

		actions.createEl("button", { text: "Delete", cls: "atmosphere-btn atmosphere-btn-danger" })
			.addEventListener("click", () => { this.confirmDelete(contentEl); });

		actions.createEl("div", { cls: "atmosphere-spacer" });

		actions.createEl("button", { text: "Cancel", cls: "atmosphere-btn atmosphere-btn-secondary" })
			.addEventListener("click", () => { this.close(); });

		actions.createEl("button", { text: "Save", cls: "atmosphere-btn atmosphere-btn-primary" })
			.addEventListener("click", () => { void this.saveChanges(); });
	}

	private addTagChip(container: HTMLElement, state: TagState) {
		const item = container.createEl("label", { cls: "atmosphere-tag-item" });
		const checkbox = item.createEl("input", { type: "checkbox" });
		checkbox.checked = state.isSelected;
		checkbox.addEventListener("change", () => { state.isSelected = checkbox.checked; });
		item.createEl("span", { text: state.tag });
	}

	private confirmDelete(contentEl: HTMLElement) {
		contentEl.empty();
		contentEl.createEl("h2", { text: "Delete item" });
		contentEl.createEl("p", { text: "Are you sure you want to delete this item?", cls: "atmosphere-warning-text" });

		const actions = contentEl.createEl("div", { cls: "atmosphere-modal-actions" });
		actions.createEl("button", { text: "Cancel", cls: "atmosphere-btn atmosphere-btn-secondary" })
			.addEventListener("click", () => { void this.onOpen(); });
		actions.createEl("button", { text: "Delete", cls: "atmosphere-btn atmosphere-btn-danger" })
			.addEventListener("click", () => { void this.handleDelete(); });
	}

	private async handleDelete() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Deleting..." });

		try {
			await this.itemSource.deleteItem!(this.item.getUri());
			new Notice("Deleted");
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

		// Read pending tag input before clearing DOM
		const pendingNewTag = this.newTagInput?.value.trim();

		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Saving..." });

		try {
			const messages: string[] = [];

			if (this.item.canAddTags() && this.itemSource.updateTags) {
				const selectedTags = this.tagStates.filter(s => s.isSelected).map(s => s.tag);
				if (pendingNewTag && !selectedTags.includes(pendingNewTag)) {
					selectedTags.push(pendingNewTag);
				}
				await this.itemSource.updateTags(this.item.getUri(), [...new Set(selectedTags)]);
				messages.push("Tags updated");
			}

			const toAdd = this.collectionStates.filter(s => s.isSelected && !s.wasSelected);
			const toRemove = this.collectionStates.filter(s => !s.isSelected && s.wasSelected);

			for (const state of toRemove) {
				if (state.linkUri) {
					const source = state.source === "semble" ? this.sembleSource : this.marginSource;
					await source.removeFromCollection(state.linkUri);
				}
			}

			for (const state of toAdd) {
				const source = state.source === "semble" ? this.sembleSource : this.marginSource;
				await source.addToCollection(this.item.getUri(), this.item.getCid(), state.uri);
			}

			if (toAdd.length > 0) messages.push(`Added to ${toAdd.length} collection${toAdd.length > 1 ? "s" : ""}`);
			if (toRemove.length > 0) messages.push(`Removed from ${toRemove.length} collection${toRemove.length > 1 ? "s" : ""}`);

			new Notice(messages.length > 0 ? messages.join(". ") : "Saved");
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
