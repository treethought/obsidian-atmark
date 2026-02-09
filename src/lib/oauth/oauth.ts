import {
	configureOAuth,
	createAuthorizationUrl,
	finalizeAuthorization,
	getSession,
	deleteStoredSession,
	OAuthUserAgent,
	Session,
} from '@atcute/oauth-browser-client';
import { compositeResolver } from 'lib/identity';
import { Notice } from 'obsidian';
import { isDid, type ActorIdentifier } from "@atcute/lexicons/syntax";
import metadata from '../../../client-metadata.json' with { type: 'json' };


export class OAuthHandler {
	private callbackResolver: ((value: URLSearchParams) => void) | null = null;
	private callbackRejecter: ((reason?: Error) => void) | null = null;
	private callbackTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		configureOAuth({
			metadata: {
				client_id: metadata.client_id,
				redirect_uri: metadata.redirect_uris[0]!,
			},
			identityResolver: compositeResolver,
		})
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

	async authorize(identifier: string): Promise<Session> {
		const authUrl = await createAuthorizationUrl({
			target: { type: 'account', identifier: identifier as ActorIdentifier },
			scope: metadata.scope,
		});
		await new Promise((resolve) => setTimeout(resolve, 200));

		const waitForCallback = new Promise<URLSearchParams>((resolve, reject) => {
			this.callbackResolver = resolve;
			this.callbackRejecter = reject;

			// timeout after 5 minutes
			this.callbackTimeout = setTimeout(() => {
				if (this.callbackRejecter) {
					this.callbackRejecter(new Error('OAuth callback timed out after 5 minutes'));
					this.callbackResolver = null;
					this.callbackRejecter = null;
				}
			}, 5 * 60_000);
		});

		window.open(authUrl, '_blank');
		new Notice('Continue login in the browser');

		const params = await waitForCallback;

		console.log('[OAuth] Callback received, params:', params.toString());
		console.log('[OAuth] Waiting for IndexedDB to settle...');
		await new Promise((resolve) => setTimeout(resolve, 1000));

		console.log('[OAuth] Starting token exchange...');
		const { session } = await finalizeAuthorization(params);
		console.log('[OAuth] Token exchange successful!');
		return session;
	}

	async restore(did: string): Promise<Session> {
		if (!isDid(did)) {
			throw new Error("Invalid DID: " + did);
		}
		const session = await getSession(did, { allowStale: false });
		if (!session) {
			throw new Error("No session found for DID: " + did);
		}
		return session;
	}

	async revoke(did: string): Promise<void> {
		if (!isDid(did)) {
			throw new Error("Invalid DID: " + did);
		}
		const session = await getSession(did, { allowStale: true });
		if (session) {
			try {
				const agent = new OAuthUserAgent(session);
				await agent.signOut();
			} catch (error) {
				console.error('Error during sign out:', error);
			}
		}
		deleteStoredSession(did);
	}

}
