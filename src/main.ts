import { Editor, MarkdownView, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import type { Client } from "@atcute/client";
import { DEFAULT_SETTINGS, AtProtoSettings, SettingTab } from "./settings";
import { createAuthenticatedClient, createPublicClient } from "./auth";
import { getCollections } from "./lib";
import { SembleCollectionsView, VIEW_TYPE_SEMBLE_COLLECTIONS } from "views/collections";
import { SembleCardsView, VIEW_TYPE_SEMBLE_CARDS } from "views/cards";
import { CreateCardModal } from "components/cardForm";

export default class ATmarkPlugin extends Plugin {
	settings: AtProtoSettings = DEFAULT_SETTINGS;
	client: Client | null = null;

	async onload() {
		await this.loadSettings();
		await this.initClient();

		this.registerView(VIEW_TYPE_SEMBLE_COLLECTIONS, (leaf) => {
			return new SembleCollectionsView(leaf, this);
		});

		this.registerView(VIEW_TYPE_SEMBLE_CARDS, (leaf) => {
			return new SembleCardsView(leaf, this);
		});
		this.addCommand({
			id: 'semble-add-card',
			name: 'Create Semble Card',
			editorCheckCallback: (checking: boolean, editor: Editor, _view: MarkdownView) => {
				const sel = editor.getSelection()

				if (!this.settings.identifier || !this.settings.appPassword) {
					new Notice("Please set your Bluesky credentials in the plugin settings to create new records.");
					return false;
				}
				if (!checking) {
					new CreateCardModal(this, sel).open();
				}
				return true;

			},
		})


		this.addCommand({
			id: "view-semble-collections",
			name: "View Semble Collections",
			callback: () => this.activateView(VIEW_TYPE_SEMBLE_COLLECTIONS),
		});

		this.addCommand({
			id: "view-semble-cards",
			name: "View Semble Cards",
			callback: () => this.activateView(VIEW_TYPE_SEMBLE_CARDS),
		});

		this.addSettingTab(new SettingTab(this.app, this));
	}


	private async initClient() {
		const { identifier, appPassword } = this.settings;
		if (identifier && appPassword) {
			try {
				this.client = await createAuthenticatedClient({ identifier, password: appPassword });
				new Notice("Connected to Bluesky");
			} catch (e) {
				new Notice(`Auth failed: ${e}`);
				this.client = createPublicClient();
			}
		} else {
			this.client = createPublicClient();
		}
	}

	async refreshClient() {
		await this.initClient();
	}


	async activateView(v: string) {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(v);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0] as WorkspaceLeaf;
			workspace.revealLeaf(leaf);
			return;
		}

		// Our view could not be found in the workspace, create a new leaf
		// in the right sidebar for it
		// leaf = workspace.getRightLeaf(false);
		leaf = workspace.getMostRecentLeaf()
		await leaf?.setViewState({ type: v, active: true });

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async openCollection(uri: string, name: string) {
		const { workspace } = this.app;
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_SEMBLE_CARDS, active: true });

		const view = leaf.view as SembleCardsView;
		view.setCollection(uri, name);

		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() { }
}
