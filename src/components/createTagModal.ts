import { Modal, Notice } from "obsidian";
import type ATmarkPlugin from "../main";
import { createTag } from "../lib";

export class CreateTagModal extends Modal {
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

		contentEl.createEl("h2", { text: "New tag" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const form = contentEl.createEl("form", { cls: "semble-form" });

		// Tag value field
		const tagGroup = form.createEl("div", { cls: "semble-form-group" });
		tagGroup.createEl("label", { text: "Tag", attr: { for: "tag-value" } });
		const tagInput = tagGroup.createEl("input", {
			type: "text",
			cls: "semble-input",
			attr: { id: "tag-value", placeholder: "Tag name", required: "true" },
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

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			void this.handleSubmit(tagInput, createBtn);
		});

		// Focus tag input
		tagInput.focus();
	}

	private async handleSubmit(
		tagInput: HTMLInputElement,
		createBtn: HTMLButtonElement
	) {
		const value = tagInput.value.trim();
		if (!value) {
			new Notice("Please enter a tag name");
			return;
		}

		createBtn.disabled = true;
		createBtn.textContent = "Creating...";

		try {
			await createTag(
				this.plugin.client!,
				this.plugin.settings.identifier,
				value
			);

			new Notice(`Created tag "${value}"`);
			this.close();
			this.onSuccess?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to create tag: ${message}`);
			createBtn.disabled = false;
			createBtn.textContent = "Create";
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
