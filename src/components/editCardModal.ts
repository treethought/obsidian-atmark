import { Modal, Notice } from "obsidian";
import type AtmospherePlugin from "../main";
import { getCollections, getCollectionLinks, createCollectionLink, getRecord, deleteRecord } from "../lib";
import type { Main as Collection } from "../lexicons/types/network/cosmik/collection";
import type { Main as CollectionLink } from "../lexicons/types/network/cosmik/collectionLink";

interface CollectionRecord {
	uri: string;
	cid: string;
	value: Collection;
}

interface CollectionLinkRecord {
	uri: string;
	value: CollectionLink;
}

interface CollectionState {
	collection: CollectionRecord;
	isSelected: boolean;
	wasSelected: boolean; // Original state to track changes
	linkUri?: string; // URI of existing link (for deletion)
}

export class EditCardModal extends Modal {
	plugin: AtmospherePlugin;
	cardUri: string;
	cardCid: string;
	onSuccess?: () => void;
	collectionStates: CollectionState[] = [];

	constructor(plugin: AtmospherePlugin, cardUri: string, cardCid: string, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.cardUri = cardUri;
		this.cardCid = cardCid;
		this.onSuccess = onSuccess;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmosphere-modal");

		contentEl.createEl("h2", { text: "Edit collections" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const loading = contentEl.createEl("p", { text: "Loading..." });

		try {
			const [collectionsResp, linksResp] = await Promise.all([
				getCollections(this.plugin.client, this.plugin.settings.identifier),
				getCollectionLinks(this.plugin.client, this.plugin.settings.identifier),
			]);

			loading.remove();

			if (!collectionsResp.ok) {
				contentEl.createEl("p", { text: "Failed to load collections.", cls: "atmosphere-error" });
				return;
			}

			const collections = collectionsResp.data.records as unknown as CollectionRecord[];
			const links = (linksResp.ok ? linksResp.data.records : []) as unknown as CollectionLinkRecord[];

			if (collections.length === 0) {
				contentEl.createEl("p", { text: "No collections found. Create a collection first." });
				return;
			}

			const cardLinks = links.filter(link => link.value.card.uri === this.cardUri);
			const linkedCollectionUris = new Map<string, string>();
			for (const link of cardLinks) {
				linkedCollectionUris.set(link.value.collection.uri, link.uri);
			}

			this.collectionStates = collections.map(collection => ({
				collection,
				isSelected: linkedCollectionUris.has(collection.uri),
				wasSelected: linkedCollectionUris.has(collection.uri),
				linkUri: linkedCollectionUris.get(collection.uri),
			}));

			this.renderCollectionList(contentEl);
		} catch (err) {
			loading.remove();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Error: ${message}`, cls: "atmosphere-error" });
		}
	}

	private renderCollectionList(contentEl: HTMLElement) {
		const list = contentEl.createEl("div", { cls: "atmosphere-collection-list" });

		for (const state of this.collectionStates) {
			const item = list.createEl("label", { cls: "atmosphere-collection-item" });

			const checkbox = item.createEl("input", { type: "checkbox", cls: "atmosphere-collection-checkbox" });
			checkbox.checked = state.isSelected;
			checkbox.addEventListener("change", () => {
				state.isSelected = checkbox.checked;
				this.updateSaveButton();
			});

			const info = item.createEl("div", { cls: "atmosphere-collection-item-info" });
			info.createEl("span", { text: state.collection.value.name, cls: "atmosphere-collection-item-name" });
			if (state.collection.value.description) {
				info.createEl("span", { text: state.collection.value.description, cls: "atmosphere-collection-item-desc" });
			}
		}

		const actions = contentEl.createEl("div", { cls: "atmosphere-modal-actions" });

		const deleteBtn = actions.createEl("button", { text: "Delete", cls: "atmosphere-btn atmosphere-btn-danger" });
		deleteBtn.addEventListener("click", () => { this.confirmDelete(contentEl); });

		actions.createEl("div", { cls: "atmosphere-spacer" });

		const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "atmosphere-btn atmosphere-btn-secondary" });
		cancelBtn.addEventListener("click", () => { this.close(); });

		const saveBtn = actions.createEl("button", { text: "Save", cls: "atmosphere-btn atmosphere-btn-primary" });
		saveBtn.id = "atmosphere-save-btn";
		saveBtn.disabled = true;
		saveBtn.addEventListener("click", () => { void this.saveChanges(); });
	}

	private confirmDelete(contentEl: HTMLElement) {
		contentEl.empty();
		contentEl.createEl("h2", { text: "Delete card" });
		contentEl.createEl("p", { text: "Delete this card?", cls: "atmosphere-warning-text" });

		const actions = contentEl.createEl("div", { cls: "atmosphere-modal-actions" });

		const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "atmosphere-btn atmosphere-btn-secondary" });
		cancelBtn.addEventListener("click", () => {
			void this.onOpen();
		});

		const confirmBtn = actions.createEl("button", { text: "Delete", cls: "atmosphere-btn atmosphere-btn-danger" });
		confirmBtn.addEventListener("click", () => { void this.deleteCard(); });
	}

	private async deleteCard() {
		if (!this.plugin.client) return;

		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Deleting card..." });

		try {
			const rkey = this.cardUri.split("/").pop();
			if (!rkey) {
				contentEl.empty();
				contentEl.createEl("p", { text: "Invalid card uri.", cls: "atmosphere-error" });
				return;
			}

			await deleteRecord(
				this.plugin.client,
				this.plugin.settings.identifier,
				"network.cosmik.card",
				rkey
			);

			new Notice("Card deleted");
			this.close();
			this.onSuccess?.();
		} catch (err) {
			contentEl.empty();
			const message = err instanceof Error ? err.message : String(err);
			contentEl.createEl("p", { text: `Failed to delete: ${message}`, cls: "atmosphere-error" });
		}
	}

	private updateSaveButton() {
		const saveBtn = document.getElementById("atmosphere-save-btn") as HTMLButtonElement | null;
		if (!saveBtn) return;

		const hasChanges = this.collectionStates.some(s => s.isSelected !== s.wasSelected);
		saveBtn.disabled = !hasChanges;
	}

	private async saveChanges() {
		if (!this.plugin.client) return;

		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Saving changes..." });

		try {
			const toAdd = this.collectionStates.filter(s => s.isSelected && !s.wasSelected);
			const toRemove = this.collectionStates.filter(s => !s.isSelected && s.wasSelected);

			for (const state of toRemove) {
				if (state.linkUri) {
					const rkey = state.linkUri.split("/").pop();
					if (rkey) {
						await deleteRecord(
							this.plugin.client,
							this.plugin.settings.identifier,
							"network.cosmik.collectionLink",
							rkey
						);
					}
				}
			}

			for (const state of toAdd) {
				const collectionRkey = state.collection.uri.split("/").pop();
				if (!collectionRkey) continue;

				const collectionResp = await getRecord(
					this.plugin.client,
					this.plugin.settings.identifier,
					"network.cosmik.collection",
					collectionRkey
				);

				if (!collectionResp.ok || !collectionResp.data.cid) continue;

				await createCollectionLink(
					this.plugin.client,
					this.plugin.settings.identifier,
					this.cardUri,
					this.cardCid,
					state.collection.uri,
					String(collectionResp.data.cid)
				);
			}

			const addedCount = toAdd.length;
			const removedCount = toRemove.length;
			const messages: string[] = [];
			if (addedCount > 0) messages.push(`Added to ${addedCount} collection${addedCount > 1 ? "s" : ""}`);
			if (removedCount > 0) messages.push(`Removed from ${removedCount} collection${removedCount > 1 ? "s" : ""}`);

			if (messages.length > 0) {
				new Notice(messages.join(". "));
			}

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
