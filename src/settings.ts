import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AtmospherePlugin from "./main";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import { OauthServer } from "./lib/oauth";
import { ATClient } from "./lib/client";
import { VIEW_TYPE_ATMOSPHERE_BOOKMARKS } from "./views/bookmarks";
import { VIEW_ATMOSPHERE_STANDARD_FEED } from "./views/standardfeed";

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
				.setName("Logged in")
				.setDesc(this.plugin.settings.identifier);

			new Setting(containerEl)
				.setName("Log out")
				.addButton((button) =>
					button
						.setButtonText("Log out")
						.setCta()
						.onClick(async () => {
							this.plugin.client = null as any;

							this.plugin.settings.identifier = "";
							await this.plugin.saveSettings();

							// close all plugin views
							this.app.workspace.detachLeavesOfType(VIEW_TYPE_ATMOSPHERE_BOOKMARKS);
							this.app.workspace.detachLeavesOfType(VIEW_ATMOSPHERE_STANDARD_FEED);

							this.display();
							new Notice("Logged out successfully");
						})
				);
		} else {
			let handleInput: HTMLInputElement;

			new Setting(containerEl)
				.setName("Log in")
				.setDesc("Enter your Bluesky or AT Protocol handle (e.g., user.bsky.social)")
				.addText((text) => {
					handleInput = text.inputEl;
					text.setPlaceholder("user.bsky.social")
						.setValue("");
				})
				.addButton((button) =>
					button
						.setButtonText("Log in")
						.setCta()
						.onClick(async () => {
							const handle = handleInput.value.trim();

							if (!handle) {
								new Notice("Please enter a handle.");
								return;
							}

							if (!isActorIdentifier(handle)) {
								new Notice("Invalid handle format. Please enter a valid AT Protocol handle (e.g., user.bsky.social).");
								return;
							}

							try {
								button.setDisabled(true);
								button.setButtonText("Logging in...");

								new Notice("Opening browser for authorization...");

								const oauth = new OauthServer();
								const session = await oauth.authorize(handle);

								this.plugin.client = new ATClient(session);
								this.plugin.settings.identifier = session.did;
								const actor = await this.plugin.client.getActor(session.did);

								await this.plugin.saveSettings();

								new Notice(`Successfully logged in as ${actor.handle}`);

								this.display();
							} catch (error) {
								console.error("Login failed:", error);
								const errorMessage = error instanceof Error ? error.message : String(error);
								new Notice(`Authentication failed: ${errorMessage}`);
								button.setDisabled(false);
								button.setButtonText("Log in");
							}
						})
				);
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
