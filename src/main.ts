import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, AtProtoSettings, SettingTab } from "./settings";
import { AtmosphereView, VIEW_TYPE_ATMOSPHERE_BOOKMARKS } from "./views/bookmarks";
import { publishFileAsDocument } from "./commands/publishDocument";
import { StandardFeedView, VIEW_ATMOSPHERE_STANDARD_FEED } from "views/standardfeed";
import { ATClient } from "lib/client";
import { Clipper } from "lib/clipper";

export default class AtmospherePlugin extends Plugin {
	settings: AtProtoSettings = DEFAULT_SETTINGS;
	client: ATClient;
	clipper: Clipper;

	async onload() {
		await this.loadSettings();
		this.client = new ATClient();
		this.clipper = new Clipper(this);

		// prevent duplicate handling
		const processedStates = new Set<string>();

		this.registerObsidianProtocolHandler('atmosphere-oauth', (params) => {
			try {
				const state = params.state as string;

				if (state && processedStates.has(state)) {
					console.log('[OAuth] Ignoring duplicate callback for state:', state);
					return;
				}

				const urlParams = new URLSearchParams();
				for (const [key, value] of Object.entries(params)) {
					if (value) {
						urlParams.set(key, String(value));
					}
				}
				if (state) {
					processedStates.add(state);
					setTimeout(() => processedStates.delete(state), 2 * 60_000);
				}

				this.client.handleOAuthCallback(urlParams);
				new Notice('Authentication completed! Processing...');
			} catch (error) {
				console.error('Error handling OAuth callback:', error);
				new Notice('Authentication error. Please try again.');
			}
		});

		this.registerView(VIEW_TYPE_ATMOSPHERE_BOOKMARKS, (leaf) => {
			return new AtmosphereView(leaf, this);
		});

		this.registerView(VIEW_ATMOSPHERE_STANDARD_FEED, (leaf) => {
			return new StandardFeedView(leaf, this);
		});

		this.addRibbonIcon("layers", "Atmosphere bookmarks", () => {
			void this.activateView(VIEW_TYPE_ATMOSPHERE_BOOKMARKS);
		});

		this.addRibbonIcon("rss", "Atmosphere feed", () => {
			void this.activateView(VIEW_ATMOSPHERE_STANDARD_FEED);
		});

		this.addCommand({
			id: "open-bookmarks",
			name: "Open bookmarks",
			callback: () => { void this.activateView(VIEW_TYPE_ATMOSPHERE_BOOKMARKS); },
		});

		this.addCommand({
			id: "open-feed",
			name: "Open feed",
			callback: () => { void this.activateView(VIEW_ATMOSPHERE_STANDARD_FEED); },
		});

		this.addCommand({
			id: "publish-note",
			name: "Publish note",
			editorCheckCallback: (checking: boolean,) => {
				const file = this.app.workspace.getActiveFile();

				if (file) {
					if (!checking) {
						void publishFileAsDocument(this)
					}

					return true
				}

				return false;
			},
		});

		this.addSettingTab(new SettingTab(this.app, this));
	}

	async checkAuth() {
		if (this.client.loggedIn) {
			return true;
		}
		if (this.settings.did) {
			try {
				await this.client.restoreSession(this.settings.did);
				return true
			} catch (e) {
				console.error("Failed to restore session:", e);
				this.settings.did = undefined;
				await this.saveSettings();
				new Notice("Session expired. Please login by opening settings");
				return false;
			}
		}
		new Notice("Please log in by opening settings");
		return false;
	}

	async activateView(v: string) {
		if (!await this.checkAuth()) {
			return;
		}

		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(v);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0] as WorkspaceLeaf;
			void workspace.revealLeaf(leaf);
			return;
		}

		// Our view could not be found in the workspace, create a new leaf
		leaf = workspace.getMostRecentLeaf()
		await leaf?.setViewState({ type: v, active: true });

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AtProtoSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() { }
}
