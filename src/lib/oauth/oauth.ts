import { OAuthClient, MemoryStore, type StoredState, type OAuthSession } from '@atcute/oauth-node-client';
import { compositeResolver } from 'lib/identity';
import { Notice } from 'obsidian';
import { OAuthSessionStore } from './oauthStore';
import { ActorIdentifier, isDid } from "@atcute/lexicons/syntax";
import metadata from '../../../client-metadata.json' with { type: 'json' };

const TEN_MINUTES_MS = 10 * 60_000;

export class OAuthHandler {
	private oauth: OAuthClient
	private sessionStore: OAuthSessionStore;
	private callbackResolver: ((value: URLSearchParams) => void) | null = null;
	private callbackRejecter: ((reason?: Error) => void) | null = null;
	private callbackTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(sessionStore: OAuthSessionStore) {
		this.sessionStore = sessionStore;
		// Initialize OAuth client with hosted redirect URL
		this.initClient(metadata.redirect_uris[0] || "");
	}

	initClient(redirectUri: string): void {
		this.oauth = new OAuthClient({
			metadata: {
				client_id: metadata.client_id,
				redirect_uris: [redirectUri],
				scope: 'atproto include:at.margin.authFull repo:site.standard.document repo:network.cosmik.card repo:network.cosmik.collection repo:network.cosmik.collectionLink',
			},
			actorResolver: compositeResolver,
			stores: {
				sessions: this.sessionStore,
				states: new MemoryStore<string, StoredState>({
					maxSize: 10,
					ttl: TEN_MINUTES_MS,
					ttlAutopurge: true,
				}),
			},
		});
	}

	handleCallback(params: URLSearchParams): void {
		if (this.callbackResolver) {
			if (this.callbackTimeout) {
				clearTimeout(this.callbackTimeout);
				this.callbackTimeout = null;
			}
			this.callbackResolver(params);
			this.callbackResolver = null;
			this.callbackRejecter = null;
		}
	}

	async authorize(identifier: string): Promise<OAuthSession> {
		const redirectUri = metadata.redirect_uris[0]!;

		// Reinitialize client with current redirect URI
		this.initClient(redirectUri);

		const { url } = await this.oauth.authorize({
			target: { type: 'account', identifier: identifier as ActorIdentifier },
			redirectUri: redirectUri,
		});

		// Create promise for callback
		const waitForCallback = new Promise<URLSearchParams>((resolve, reject) => {
			this.callbackResolver = resolve;
			this.callbackRejecter = reject;

			// Timeout after 5 minutes
			this.callbackTimeout = setTimeout(() => {
				if (this.callbackRejecter) {
					this.callbackRejecter(new Error('OAuth callback timed out after 5 minutes'));
					this.callbackResolver = null;
					this.callbackRejecter = null;
				}
			}, 5 * 60_000);
		});

		window.open(url.href, '_blank');
		new Notice('Continue login in the browser')

		const params = await waitForCallback;
		const { session } = await this.oauth.callback(params, { redirectUri });

		return session;
	}

	async restore(did: string): Promise<OAuthSession> {
		if (!isDid(did)) {
			throw new Error("Invalid DID: " + did);
		}
		return await this.oauth.restore(did)
	}

	async revoke(did: string): Promise<void> {
		if (!isDid(did)) {
			throw new Error("Invalid DID: " + did);
		}
		await this.oauth.revoke(did);
	}
}
