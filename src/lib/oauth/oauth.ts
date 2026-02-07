import * as http from 'http';
import { OAuthClient, MemoryStore, type StoredState, type OAuthSession, } from '@atcute/oauth-node-client';
import { compositeResolver } from 'lib/identity';
import { Notice } from 'obsidian';
import { OAuthSessionStore } from './oauthStore';
import { isDid } from "@atcute/lexicons/syntax";

const TEN_MINUTES_MS = 10 * 60_000;

const html = `<!doctype html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Authentication Successful</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			margin: 0;
			background: #f0f9ff;
		}
		.container {
			text-align: center;
			padding: 2rem;
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		}
		h1 { color: #0ea5e9; margin: 0 0 1rem 0; }
		p { color: #6b7280; margin: 0; }
	</style>
</head>
<body>
	<div class="container">
		<h1>✅ Authenticated!</h1>
		<p>You can close this window and return to Obsidian.</p>
	</div>
</body>
</html>`


type CallbackResult = {
	redirectUri: string;
	waitForCallback: Promise<URLSearchParams>;
}

export class OAuthServer {
	private server: http.Server | null = null;
	private port: number = 0;
	private redirectUri: string = '';
	private resolveCallback: ((value: URLSearchParams) => void) | null = null;
	private rejectCallback: ((reason?: Error) => void) | null = null;
	private timeout: NodeJS.Timeout | null = null;
	sessionStore: OAuthSessionStore;

	async start(): Promise<CallbackResult> {
		if (this.server) {
			const wait = new Promise<URLSearchParams>((resolve, reject) => {
				this.resolveCallback = resolve;
				this.rejectCallback = reject;
			})
			return { redirectUri: this.redirectUri, waitForCallback: wait };
		}

		const redirectUri = await this.startServer();

		const waitCallback = new Promise<URLSearchParams>((resolve, reject) => {
			this.resolveCallback = resolve;
			this.rejectCallback = reject;
			this.timeout = setTimeout(() => {
				if (this.rejectCallback) {
					this.rejectCallback(new Error('OAuth callback timed out after 5 minutes'));
				}
				this.cleanup();
			}, 5 * 60_000);
		})

		return { redirectUri, waitForCallback: waitCallback };
	}

	private async startServer(): Promise<string> {
		return new Promise((resolve, reject) => {
			this.server = http.createServer((req, res) => {
				const url = new URL(req.url!, `http://127.0.0.1:${this.port}`);

				if (url.pathname === '/callback') {
					if (this.resolveCallback) {
						this.resolveCallback(url.searchParams);
					}
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end(html);
					return;
				}

				res.writeHead(404, { 'Content-Type': 'text/plain' });
				res.end('Not Found');
			});

			this.server.on('error', (err: NodeJS.ErrnoException) => {
				console.error('Oauth callback server error:', err);
				reject(err);
			});

			this.server.on('listening', () => {
				const address = this.server?.address();
				if (address && typeof address === 'object') {
					this.port = address.port;
					this.redirectUri = `http://127.0.0.1:${this.port}/callback`;
					resolve(this.redirectUri);
				} else {
					reject(new Error('Failed to get server address'));
				}
			});
			// use random port number
			this.server.listen(0, '127.0.0.1');
		});
	}
	cleanup(): void {
		if (this.server) {
			this.server.close();
			this.server = null;
		}

		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}

		this.resolveCallback = null;
		this.rejectCallback = null;
	}
}


export class OAuthHandler {
	private oauth: OAuthClient
	private server: OAuthServer;
	private sessionStore: OAuthSessionStore;

	constructor(sessionStore: OAuthSessionStore) {
		this.server = new OAuthServer();
		this.sessionStore = sessionStore;
		// Initialize OAuth client immediately so restore() works
		this.initClient('http://127.0.0.1/callback');
	}

	initClient(redirectUri: string): void {
		this.oauth = new OAuthClient({
			metadata: {
				redirect_uris: [redirectUri], // updated after starting server
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


	async authorize(identifier: string): Promise<OAuthSession> {
		const result = await this.server.start();
		// client must be created after starting server to use proper redirect
		this.initClient(result.redirectUri);

		const { url } = await this.oauth!.authorize({
			target: { type: 'account', identifier: identifier as any },
			redirectUri: result.redirectUri,
		});

		window.open(url.href, '_blank');
		new Notice('Continue login in the browser')

		const params = await result.waitForCallback;

		const { session } = await this.oauth!.callback(params, { redirectUri: result.redirectUri });
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
