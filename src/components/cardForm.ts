// import { ok } from "@atcute/client";
// import { createNoteCard } from "lib";
// import AtmospherePlugin from "main";
// import { Modal, Notice } from "obsidian";
//
// export class CreateCardModal extends Modal {
// 	plugin: AtmospherePlugin;
// 	content: string | undefined;
//
//
// 	constructor(plugin: AtmospherePlugin, content?: string) {
// 		super(plugin.app);
// 		this.plugin = plugin;
// 		this.content = content;
// 	}
//
// 	onOpen() {
// 		const { contentEl } = this;
// 		contentEl.createEl("h2", { text: "Create new card" });
//
// 		// Add form elements here
// 		contentEl.createEl("label", { text: "Card title" });
// 		contentEl.createEl("input", { type: "text" });
// 		contentEl.createEl("br");
//
//
// 		let contentInput: HTMLTextAreaElement | null = null;
// 		if (!this.content) {
// 			contentEl.createEl("label", { text: "Card content" });
// 			contentInput = contentEl.createEl("textarea");
// 			contentEl.createEl("br");
// 		} else {
// 			// fill textarea with this.content and make it read-only
// 			contentInput = contentEl.createEl("textarea");
// 			contentInput.value = this.content;
// 			contentInput.readOnly = true;
// 			contentEl.createEl("br");
// 		}
//
//
//
//
// 		const createButton = contentEl.createEl("button", { text: "Create card" });
// 		createButton.onclick = async () => {
// 			let text = this.content;
// 			if (contentInput) {
// 				text = contentInput.value || this.content;
// 			}
// 			if (!text) {
// 				new Notice("Please enter some text");
// 				return;
// 			}
// 			await ok(createNoteCard(this.plugin.client!, this.plugin.settings.identifier, text));
// 			new Notice("Card created successfully!");
// 			this.close();
// 		};
// 	}
//
// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }
