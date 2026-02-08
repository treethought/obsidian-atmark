import { Modal, Notice } from "obsidian";
import type AtmospherePlugin from "../main";
import { createTag } from "../lib";

export class CreateTagModal extends Modal {
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

		contentEl.createEl("h2", { text: "New tag" });

		if (!this.plugin.client) {
			contentEl.createEl("p", { text: "Not connected." });
			return;
		}

		const form = contentEl.createEl("form", { cls: "atmosphere-form" });

		const tagGroup = form.createEl("div", { cls: "atmosphere-form-group" });
		tagGroup.createEl("label", { text: "Tag", attr: { for: "tag-value" } });
		const tagInput = tagGroup.createEl("input", {
			type: "text",
			cls: "atmosphere-input",
			attr: { id: "tag-value", placeholder: "Tag name", required: "true" },
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
			void this.handleSubmit(tagInput, createBtn);
		});

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
				this.plugin.client,
				this.plugin.settings.did!,
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
