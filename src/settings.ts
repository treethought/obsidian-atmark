import { App, PluginSettingTab, Setting } from "obsidian";
import type ATmarkPlugin from "./main";

export interface AtProtoSettings {
	identifier: string;
	appPassword: string;
	serviceUrl: string;
}

export const DEFAULT_SETTINGS: AtProtoSettings = {
	identifier: "",
	appPassword: "",
	serviceUrl: "",
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
			.setName("Handle")
			.setDesc("Your bluesky handle or identifier (e.g., user.bsky.social)")
			// .setDesc("user.bsky.social")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.identifier)
					.onChange(async (value) => {
						this.plugin.settings.identifier = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("App password")
			.setDesc("Create one at https://bsky.app/settings/app-passwords")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setValue(this.plugin.settings.appPassword)
					.onChange(async (value) => {
						this.plugin.settings.appPassword = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Auth service")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("PDS or PDS entryway URL (leave empty to use bsky.social service) ")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("https://bsky.social")
					.setValue(this.plugin.settings.serviceUrl)
					.onChange(async (value) => {
						this.plugin.settings.serviceUrl = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
