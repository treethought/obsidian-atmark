import { App, PluginSettingTab, Setting } from "obsidian";
import type AtmospherePlugin from "./main";

export interface AtProtoSettings {
	identifier: string;
	appPassword: string;
	clipDir: string;
}

export const DEFAULT_SETTINGS: AtProtoSettings = {
	identifier: "",
	appPassword: "",
	clipDir: "AtmosphereClips",
};

export class SettingTab extends PluginSettingTab {
	plugin: AtmospherePlugin;

	constructor(app: App, plugin: AtmospherePlugin) {
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
			.setName("Clip directory")
			.setDesc("Directory in your vault to save clips (will be created if it doesn't exist)")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.clipDir)
					.onChange(async (value) => {
						this.plugin.settings.clipDir = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
