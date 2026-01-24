import { App, PluginSettingTab, Setting } from "obsidian";
import type ATmarkPlugin from "./main";

export interface AtProtoSettings {
	identifier: string;
	appPassword: string;
}

export const DEFAULT_SETTINGS: AtProtoSettings = {
	identifier: "",
	appPassword: "",
};

export class SettingTab extends PluginSettingTab {
	plugin: ATmarkPlugin;

	constructor(app: App, plugin: ATmarkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
					// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName("Handle or DID")
			.setDesc("Your handle or did (e.g., user.bsky.social)")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("user.bsky.social")
					.setValue(this.plugin.settings.identifier)
					.onChange(async (value) => {
						this.plugin.settings.identifier = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("App password")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("Create one at Settings → Privacy and security → App passwords")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("xxxx-xxxx-xxxx-xxxx")
					.setValue(this.plugin.settings.appPassword)
					.onChange(async (value) => {
						this.plugin.settings.appPassword = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
