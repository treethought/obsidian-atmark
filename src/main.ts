import { Plugin, WorkspaceLeaf } from "obsidian";
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

		const creds = {
			identifier: this.settings.identifier,
			password: this.settings.appPassword,
		};
		this.client = new ATClient(creds);
		this.clipper = new Clipper(this);

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
			name: "Publish document",
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



	async activateView(v: string) {
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
