import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, AtProtoSettings, SettingTab } from "./settings";
import { ATmarkView, VIEW_TYPE_ATMARK } from "./views/atmark";
import { publishFileAsDocument } from "./commands/publishDocument";
import { StandardFeedView, VIEW_STANDARD_FEED } from "views/standardfeed";
import { ATClient } from "lib/client";

export default class ATmarkPlugin extends Plugin {
	settings: AtProtoSettings = DEFAULT_SETTINGS;
	client: ATClient

	async onload() {
		await this.loadSettings();

		const creds = {
			identifier: this.settings.identifier,
			password: this.settings.appPassword,
		};
		this.client = new ATClient(creds);

		this.registerView(VIEW_TYPE_ATMARK, (leaf) => {
			return new ATmarkView(leaf, this);
		});

		this.registerView(VIEW_STANDARD_FEED, (leaf) => {
			return new StandardFeedView(leaf, this);
		});

		// included name of the plugin, which contains the acronym "AT"
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		this.addRibbonIcon("layers", "ATmark bookmarks", () => {
			void this.activateView(VIEW_TYPE_ATMARK);
		});

		// included name of the plugin, which contains the acronym "AT"
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		this.addRibbonIcon("rss", "ATmark feed", () => {
			void this.activateView(VIEW_STANDARD_FEED);
		});

		this.addCommand({
			id: "view",
			name: "Open view",
			callback: () => { void this.activateView(VIEW_TYPE_ATMARK); },
		});

		// this.addCommand({
		// 	id: "standard-site-view",
		// 	name: "View publications",
		// 	callback: () => { void this.activateView(VIEW_TYPE_STANDARD_SITE); },
		// });

		this.addCommand({
			id: "standard-site-publich-document",
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
