import { App, Notice, PluginSettingTab, Setting, setIcon } from "obsidian";
import type AtmospherePlugin from "./main";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import { VIEW_TYPE_ATMOSPHERE_BOOKMARKS } from "./views/bookmarks";
import { VIEW_ATMOSPHERE_STANDARD_FEED } from "./views/standardfeed";
import { getPublications } from "./lib/standardsite";
import type { SiteStandardPublication } from "@atcute/standard-site";
import type { ATRecord } from "./lib";

export interface AtProtoSettings {
	did?: string;
	clipDir: string;
	publish: {
		useFirstHeaderAsTitle: boolean;
	};
	publicationFormats: Record<string, ContentFormat>;
	hiddenPublications: Record<string, boolean>;
}

export type ContentFormat = "leaflet" | "pckt" | "plaintext";

export const DEFAULT_SETTINGS: AtProtoSettings = {
	clipDir: "AtmosphereClips",
	publish: {
		useFirstHeaderAsTitle: false,
	},
	publicationFormats: {},
	hiddenPublications: {},
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
		const pubsSection = containerEl.createEl("div");
		void this.renderPublications(pubsSection);
	}

	private async renderPublications(containerEl: HTMLElement): Promise<void> {
		containerEl.empty();
		containerEl.createEl("h3", { text: "Publications" });

		if (!this.plugin.client.loggedIn || !this.plugin.client.actor?.did) {
			containerEl.createEl("p", { text: "Log in to load publications." });
			return;
		}

		const loading = containerEl.createEl("p", { text: "Loading publications..." });
		try {
			const resp = await getPublications(this.plugin.client, this.plugin.client.actor.did);
			loading.remove();

			if (resp.records.length === 0) {
				containerEl.createEl("p", { text: "No publications found." });
				return;
			}

			const allPubs = resp.records as ATRecord<SiteStandardPublication.Main>[];
			const visiblePubs: ATRecord<SiteStandardPublication.Main>[] = [];
			const hiddenPubs: ATRecord<SiteStandardPublication.Main>[] = [];
			for (const pub of allPubs) {
				if (this.plugin.settings.hiddenPublications?.[pub.uri]) {
					hiddenPubs.push(pub);
				} else {
					visiblePubs.push(pub);
				}
			}

			for (const pub of [...visiblePubs, ...hiddenPubs]) {
				const current = this.plugin.settings.publicationFormats[pub.uri] ?? "plaintext";
				let isVisible = !(this.plugin.settings.hiddenPublications[pub.uri] ?? false);
				const setting = new Setting(containerEl);
				setting
					.setName(pub.value.name ?? pub.uri)
					.setDesc(pub.value.url)
					.addExtraButton((button) => {
						const updateIcon = () => {
							button.setTooltip(isVisible ? "Visible in lists" : "Hidden from lists");
							setIcon(button.extraSettingsEl, isVisible ? "eye" : "eye-off");
							setting.settingEl.toggleClass("atmosphere-publication-hidden", !isVisible);
						};
						updateIcon();
						button.onClick(async () => {
							isVisible = !isVisible;
							this.plugin.settings.hiddenPublications[pub.uri] = !isVisible;
							await this.plugin.saveSettings();
							updateIcon();
						});
					})
					.addDropdown((dropdown) => {
						dropdown
							.addOption("leaflet", "Leaflet.pub")
							.addOption("pckt", "Pckt.blog")
							.addOption("plaintext", "Plaintext")
							.setValue(current)
							.onChange(async (value) => {
								this.plugin.settings.publicationFormats[pub.uri] = value as ContentFormat;
								await this.plugin.saveSettings();
							});
					});
				setting.settingEl.toggleClass("atmosphere-publication-hidden", !isVisible);
			}
		} catch (error) {
			loading.remove();
			const message = error instanceof Error ? error.message : String(error);
			containerEl.createEl("p", { text: `Failed to load publications: ${message}` });
		}
	}
}
