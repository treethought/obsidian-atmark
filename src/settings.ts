import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AtmospherePlugin from "./main";

export interface AtProtoSettings {
	identifier: string;
	clipDir: string;
	publish: {
		useFirstHeaderAsTitle: boolean;
	};
}

export const DEFAULT_SETTINGS: AtProtoSettings = {
	identifier: "",
	clipDir: "AtmosphereClips",
	publish: {
		useFirstHeaderAsTitle: false,
	}
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

		containerEl.createEl("h2", { text: "Atmosphere Settings" });

		if (this.plugin.settings.identifier) {
			new Setting(containerEl)
				.setName("Authenticated as")
				.setDesc(this.plugin.settings.identifier);

			new Setting(containerEl)
				.setName("Log out")
				.setDesc("Clear your authentication and log out")
				.addButton((button) =>
					button
						.setButtonText("Log out")
						.setCta()
						.onClick(async () => {
							this.plugin.session = null;
							this.plugin.client = null as any;

							this.plugin.settings.identifier = "";
							await this.plugin.saveSettings();

							// refresh settings
							this.display();
							new Notice("Logged out successfully");
						})
				);
		} else {
			containerEl.createEl("p", {
				text: "You'll be prompted to authenticate via OAuth when you first use the plugin.",
			});
		}

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

		new Setting(containerEl)
			.setName("Use first header as publish title")
			.setDesc('Use the first level one header instead of filename when no title property is set')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.publish.useFirstHeaderAsTitle)
					.onChange(async (value) => {
						this.plugin.settings.publish.useFirstHeaderAsTitle = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
