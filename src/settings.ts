import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AtmospherePlugin from "./main";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import { BookmarksView, VIEW_TYPE_ATMOSPHERE_BOOKMARKS } from "./views/bookmarks";
import { VIEW_ATMOSPHERE_STANDARD_FEED } from "./views/standardfeed";


export interface AtProtoSettings {
	did?: string;
	clipDir: string;
	bookmarks: {
		enabledSources: Record<string, boolean>;
	}
	publish: {
		useFirstHeaderAsTitle: boolean;
	};
}

export const DEFAULT_SETTINGS: AtProtoSettings = {
	clipDir: "AtmosphereClips",
	bookmarks: {
		enabledSources: { "semble": true, "margin": true, "bookmark": true },
	},
	publish: {
		useFirstHeaderAsTitle: false,
	},
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

		if (this.plugin.client.loggedIn) {
			const displayName = this.plugin.client.actor?.handle || this.plugin.settings.did;

			new Setting(containerEl)
				.setName("Logged in as @" + displayName)
				.setDesc(this.plugin.client.actor?.did as string || "")
				.addButton((button) =>
					button
						.setButtonText("Log out")
						.setCta()
						.onClick(async () => {
							await this.plugin.client.logout(this.plugin.settings.did!)
							this.plugin.settings.did = undefined;
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
				.setDesc("Enter your handle (e.g., user.bsky.social)")
				.addText((text) => {
					handleInput = text.inputEl;
					text.setValue("");
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
								new Notice("Invalid handle format. Please enter a valid handle (e.g., user.bsky.social).");
								return;
							}

							try {
								button.setDisabled(true);
								button.setButtonText("Logging in...");

								new Notice("Opening browser for authorization...");
								await this.plugin.client.login(handle)
								this.plugin.settings.did = this.plugin.client.actor?.did;
								await this.plugin.saveSettings();

								this.display()
								new Notice(`Successfully logged in as ${this.plugin.client.actor!.handle}`);
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


		new Setting(containerEl).setName("Bookmarks").setHeading()

		const bookmarkSources: Array<{ name: string; label: string; desc: string }> = [
			{ name: "semble", label: "Semble", desc: "Include Semble bookmarks" },
			{ name: "margin", label: "Margin", desc: "Include Margin bookmarks" },
			{ name: "bookmark", label: "Community", desc: "Include community lexcion bookmarks" },
		];

		for (const source of bookmarkSources) {
			new Setting(containerEl)
				.setName(source.label)
				.setDesc(source.desc)
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.bookmarks?.enabledSources?.[source.name] ?? true)
						.onChange(async (value) => {
							this.plugin.settings.bookmarks.enabledSources[source.name] = value;
							await this.plugin.saveSettings();
							for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ATMOSPHERE_BOOKMARKS)) {
								let view = leaf.view as BookmarksView;
								if (view instanceof BookmarksView) {
									await view.render()
								}

							}
						})
				);
		}

		new Setting(containerEl).setName("Publishing").setHeading()
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
