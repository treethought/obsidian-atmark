import { Store, StoredSession } from "@atcute/oauth-node-client";
import { Did } from "@atcute/lexicons/syntax";
import AtmospherePlugin from "main";


export class OAuthSessionStore implements Store<Did, StoredSession> {
	plugin: AtmospherePlugin;

	constructor(plugin: AtmospherePlugin) {
		this.plugin = plugin;
	}

	async get(key: Did): Promise<StoredSession | undefined> {
		const sessions = this.plugin.settings.oauth.sessions ?? {};
		return sessions[key];
	}

	async set(key: Did, value: StoredSession): Promise<void> {
		if (!this.plugin.settings.oauth.sessions) {
			this.plugin.settings.oauth.sessions = {};
		}
		this.plugin.settings.oauth.sessions[key] = value;
		await this.plugin.saveSettings();
	}

	async delete(key: Did): Promise<void> {
		if (this.plugin.settings.oauth.sessions) {
			delete this.plugin.settings.oauth.sessions[key];
			await this.plugin.saveSettings();
			return;
		}
	}

	async clear(): Promise<void> {
		this.plugin.settings.oauth.sessions = {};
		await this.plugin.saveSettings();
	}
}
