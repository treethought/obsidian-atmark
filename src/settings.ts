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
			.setName("Handle or DID")
			.setDesc("Your Bluesky handle (e.g., user.bsky.social) or DID")
			.addText((text) =>
				text
					.setPlaceholder("user.bsky.social")
					.setValue(this.plugin.settings.identifier)
					.onChange(async (value) => {
						this.plugin.settings.identifier = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("App Password")
			.setDesc("Create one at Settings → Privacy and Security → App Passwords")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("xxxx-xxxx-xxxx-xxxx")
					.setValue(this.plugin.settings.appPassword)
					.onChange(async (value) => {
						this.plugin.settings.appPassword = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
