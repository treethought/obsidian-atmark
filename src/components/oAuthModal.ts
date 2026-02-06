import { Modal, Notice, setIcon } from "obsidian";
import type AtmospherePlugin from "../main";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import { OauthServer } from "../lib/oauth";
import type { OAuthSession } from "@atcute/oauth-node-client";

export class OAuthModal extends Modal {
	plugin: AtmospherePlugin;
	onSuccess?: (session: OAuthSession) => void;

	constructor(plugin: AtmospherePlugin, onSuccess?: (session: OAuthSession) => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("atmosphere-detail-modal");

		contentEl.createEl("h2", { text: "Log in" });
		contentEl.createEl("p", {
			text: "Log in with your Bluesky or AT Procol account"
		});

		const handleInput = contentEl.createEl("input", {
			type: "text",
			placeholder: "Enter your handle (user.bsky.social)"
		});

		const loginButton = contentEl.createEl("button", { text: "Log in" });
		setIcon(loginButton, "enter");

		loginButton.addEventListener("click", async () => {
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
				loginButton.disabled = true;
				loginButton.textContent = "Starting OAuth flow...";

				new Notice("Opening browser for authorization...");

				const oauth = new OauthServer();
				const session = await oauth.authorize(handle);
				new Notice(`Successfully authenticated as ${session.handle}`);

				// Call the success callback and close the modal
				if (this.onSuccess) {
					this.onSuccess(session);
				}
				this.close();
			} catch (error) {
				console.error("OAuth error:", error);
				const errorMessage = error instanceof Error ? error.message : String(error);
				new Notice(`Authentication failed: ${errorMessage}`);
				loginButton.disabled = false;
				loginButton.textContent = "Log in";
			}
		});

		handleInput.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				loginButton.click();
			}
		});
		handleInput.focus();
	}
	onClose() {
		this.contentEl.empty();
	}
}
