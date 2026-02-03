import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import type { Client } from "@atcute/client";
import { DEFAULT_SETTINGS, AtProtoSettings, SettingTab } from "./settings";
import { createAuthenticatedClient } from "./auth";
import { ATmarkView, VIEW_TYPE_ATMARK } from "./views/atmark";
import { publishFileAsDocument } from "./commands/publishDocument";

export default class ATmarkPlugin extends Plugin {
	settings: AtProtoSettings = DEFAULT_SETTINGS;
	client: Client | null = null;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_ATMARK, (leaf) => {
			return new ATmarkView(leaf, this);
		});


		this.addRibbonIcon("layers", "Atmark bookmarks", () => {
			void this.activateView(VIEW_TYPE_ATMARK);
		});

		this.addCommand({
			id: "view",
			name: "Open view",
			callback: () => { void this.activateView(VIEW_TYPE_ATMARK); },
		});


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


	async initClient() {
		const { identifier, appPassword, serviceUrl } = this.settings;
		if (identifier && appPassword) {
			try {
				this.client = await createAuthenticatedClient({ identifier, password: appPassword, serviceUrl });
				new Notice("Connected");
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error("Failed to login:", message);
			}
		}
	}

	async refreshClient() {
		await this.initClient();
	}


	async activateView(v: string) {
		const { workspace } = this.app;
		if (!this.client) {
			await this.initClient();
		}
		if (!this.client) {
			new Notice("Failed to login. Check your credentials in plugin settings.");
			return;
		}

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
