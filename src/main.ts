import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import type { Client } from "@atcute/client";
import { DEFAULT_SETTINGS, AtProtoSettings, SettingTab } from "./settings";
import { createAuthenticatedClient, createPublicClient } from "./auth";
import { getProfile } from "./lib";
import { ATmarkView, VIEW_TYPE_ATMARK } from "views/atmark";
import type { ProfileData } from "components/profileIcon";

export default class ATmarkPlugin extends Plugin {
	settings: AtProtoSettings = DEFAULT_SETTINGS;
	client: Client | null = null;
	profile: ProfileData | null = null;

	async onload() {
		await this.loadSettings();
		await this.initClient();

		this.registerView(VIEW_TYPE_ATMARK, (leaf) => {
			return new ATmarkView(leaf, this);
		});

		this.addCommand({
			id: "view-atmark",
			name: "View ATmark",
			callback: () => { void this.activateView(VIEW_TYPE_ATMARK); },
		});

		this.addSettingTab(new SettingTab(this.app, this));
	}


	private async initClient() {
		const { identifier, appPassword } = this.settings;
		if (identifier && appPassword) {
			try {
				this.client = await createAuthenticatedClient({ identifier, password: appPassword });
				await this.fetchProfile();
				new Notice("Connected");
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				new Notice(`Auth failed: ${message}`);
				this.client = createPublicClient();
				this.profile = null;
			}
		} else {
			this.client = createPublicClient();
			this.profile = null;
		}
	}

	private async fetchProfile() {
		if (!this.client || !this.settings.identifier) {
			this.profile = null;
			return;
		}
		try {
			const resp = await getProfile(this.client, this.settings.identifier);
			if (resp.ok) {
				this.profile = {
					did: resp.data.did,
					handle: resp.data.handle,
					displayName: resp.data.displayName,
					avatar: resp.data.avatar,
				};
			} else {
				this.profile = null;
			}
		} catch (e) {
			console.error("Failed to fetch profile:", e);
			this.profile = null;
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
