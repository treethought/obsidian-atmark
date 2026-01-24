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
		contentEl.addClass("semble-collection-modal");

		contentEl.createEl("h2", { text: "New Collection" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const form = contentEl.createEl("form", { cls: "semble-form" });

		// Name field
		const nameGroup = form.createEl("div", { cls: "semble-form-group" });
		nameGroup.createEl("label", { text: "Name", attr: { for: "collection-name" } });
		const nameInput = nameGroup.createEl("input", {
			type: "text",
			cls: "semble-input",
			attr: { id: "collection-name", placeholder: "Collection name", required: "true" },
		});

		// Description field
		const descGroup = form.createEl("div", { cls: "semble-form-group" });
		descGroup.createEl("label", { text: "Description", attr: { for: "collection-desc" } });
		const descInput = descGroup.createEl("textarea", {
			cls: "semble-textarea",
			attr: { id: "collection-desc", placeholder: "Optional description", rows: "3" },
		});

		// Action buttons
		const actions = form.createEl("div", { cls: "semble-modal-actions" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "semble-btn semble-btn-secondary",
			type: "button",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const createBtn = actions.createEl("button", {
			text: "Create",
			cls: "semble-btn semble-btn-primary",
			type: "submit",
		});

		form.addEventListener("submit", async (e) => {
			e.preventDefault();

			const name = nameInput.value.trim();
			if (!name) {
				new Notice("Please enter a collection name");
				return;
			}

			createBtn.disabled = true;
			createBtn.textContent = "Creating...";

			try {
				await createCollection(
					this.plugin.client!,
					this.plugin.settings.identifier,
					name,
					descInput.value.trim()
				);

				new Notice(`Created collection "${name}"`);
				this.close();
				this.onSuccess?.();
			} catch (e) {
				new Notice(`Failed to create collection: ${e}`);
				createBtn.disabled = false;
				createBtn.textContent = "Create";
			}
		});

		// Focus name input
		nameInput.focus();
	}

	onClose() {
		this.contentEl.empty();
	}
}
