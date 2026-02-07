import { Modal, Notice } from "obsidian";
import type AtmospherePlugin from "../main";
import { createMarginCollection } from "../lib";

export class CreateMarginCollectionModal extends Modal {
	plugin: AtmospherePlugin;
	onSuccess?: () => void;

	constructor(plugin: AtmospherePlugin, onSuccess?: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmosphere-modal");

		contentEl.createEl("h2", { text: "New margin collection" });

		if (!this.plugin.client) {
			// contentEl.createEl("p", { text: "Not Logged In. Please Login Using Settings." });
			return;
		}

		const form = contentEl.createEl("form", { cls: "atmosphere-form" });

		const nameGroup = form.createEl("div", { cls: "atmosphere-form-group" });
		nameGroup.createEl("label", { text: "Name", attr: { for: "collection-name" } });
		const nameInput = nameGroup.createEl("input", {
			type: "text",
			cls: "atmosphere-input",
			attr: { id: "collection-name", placeholder: "Collection name", required: "true" },
		});

		const iconGroup = form.createEl("div", { cls: "atmosphere-form-group" });
		iconGroup.createEl("label", { text: "Icon (optional)", attr: { for: "collection-icon" } });
		const iconInput = iconGroup.createEl("input", {
			type: "text",
			cls: "atmosphere-input",
			attr: { id: "collection-icon" },
		});

		const descGroup = form.createEl("div", { cls: "atmosphere-form-group" });
		descGroup.createEl("label", { text: "Description", attr: { for: "collection-desc" } });
		const descInput = descGroup.createEl("textarea", {
			cls: "atmosphere-textarea",
			attr: { id: "collection-desc", placeholder: "Optional description", rows: "3" },
		});

		const actions = form.createEl("div", { cls: "atmosphere-modal-actions" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "atmosphere-btn atmosphere-btn-secondary",
			type: "button",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const createBtn = actions.createEl("button", {
			text: "Create",
			cls: "atmosphere-btn atmosphere-btn-primary",
			type: "submit",
		});

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			void this.handleSubmit(nameInput, iconInput, descInput, createBtn);
		});

		nameInput.focus();
	}

	private async handleSubmit(
		nameInput: HTMLInputElement,
		iconInput: HTMLInputElement,
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
			await createMarginCollection(
				this.plugin.client,
				this.plugin.settings.did!,
				name,
				descInput.value.trim() || undefined,
				iconInput.value.trim() || undefined
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
