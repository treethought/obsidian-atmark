import { Modal, Notice } from "obsidian";
import type ATmarkPlugin from "../main";
import { createCollection } from "../lib";

export class CreateCollectionModal extends Modal {
	plugin: ATmarkPlugin;
	onSuccess?: () => void;

	constructor(plugin: ATmarkPlugin, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmark-modal");

		contentEl.createEl("h2", { text: "New collection" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const form = contentEl.createEl("form", { cls: "atmark-form" });

		const nameGroup = form.createEl("div", { cls: "atmark-form-group" });
		nameGroup.createEl("label", { text: "Name", attr: { for: "collection-name" } });
		const nameInput = nameGroup.createEl("input", {
			type: "text",
			cls: "atmark-input",
			attr: { id: "collection-name", placeholder: "Collection name", required: "true" },
		});

		const descGroup = form.createEl("div", { cls: "atmark-form-group" });
		descGroup.createEl("label", { text: "Description", attr: { for: "collection-desc" } });
		const descInput = descGroup.createEl("textarea", {
			cls: "atmark-textarea",
			attr: { id: "collection-desc", placeholder: "Optional description", rows: "3" },
		});

		const actions = form.createEl("div", { cls: "atmark-modal-actions" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "atmark-btn atmark-btn-secondary",
			type: "button",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const createBtn = actions.createEl("button", {
			text: "Create",
			cls: "atmark-btn atmark-btn-primary",
			type: "submit",
		});

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			void this.handleSubmit(nameInput, descInput, createBtn);
		});

		nameInput.focus();
	}

	private async handleSubmit(
		nameInput: HTMLInputElement,
		descInput: HTMLTextAreaElement,
		createBtn: HTMLButtonElement
	) {
		const name = nameInput.value.trim();
		if (!name) {
			new Notice("Please enter a collection name");
			return;
		}

		createBtn.disabled = true;
		createBtn.textContent = "Creating...";

		try {
			await createCollection(
				this.plugin.client,
				this.plugin.settings.identifier,
				name,
				descInput.value.trim()
			);

			new Notice(`Created collection "${name}"`);
			this.close();
			this.onSuccess?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to create collection: ${message}`);
			createBtn.disabled = false;
			createBtn.textContent = "Create";
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
