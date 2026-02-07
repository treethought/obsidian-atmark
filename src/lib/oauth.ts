import * as http from 'http';
import { OAuthClient, MemoryStore, type StoredState, type OAuthSession } from '@atcute/oauth-node-client';
import { compositeResolver } from './identity';
import { Notice } from 'obsidian';

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

export class OauthServer {
	private server: http.Server | null = null;
	private port: number = 0;
	private redirectUri: string = '';
	private oauth: OAuthClient | null = null;
	private resolveCallback: ((value: URLSearchParams) => void) | null = null;
	private rejectCallback: ((reason?: any) => void) | null = null;
	private timeout: NodeJS.Timeout | null = null;

	private async startServer(): Promise<string> {
		if (this.server) {
			return this.redirectUri;
		}

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
					console.log(`OAuth callback server listening on ${this.redirectUri}`);
					resolve(this.redirectUri);
				} else {
					reject(new Error('Failed to get server address'));
				}
			});
			// use random port number
			this.server.listen(0, '127.0.0.1');
		});
	}

	async authorize(identifier: string): Promise<OAuthSession> {
		const redirectUri = await this.startServer();

		// create oauth client with redirect  based on the started server
		this.oauth = new OAuthClient({
			metadata: {
				redirect_uris: [redirectUri],
				scope: 'atproto include:at.margin.authFull repo:site.standard.document repo:network.cosmik.card repo:network.cosmik.collection repo:network.cosmik.collectionLink',
			},
			actorResolver: compositeResolver,
			stores: {
				sessions: new MemoryStore({ maxSize: 10 }),
				states: new MemoryStore<string, StoredState>({
					maxSize: 10,
					ttl: TEN_MINUTES_MS,
					ttlAutopurge: true,
				}),
			},
		});

		const deferred = new Promise<URLSearchParams>((resolve, reject) => {
			this.resolveCallback = resolve;
			this.rejectCallback = reject;
		});

		this.timeout = setTimeout(() => {
			if (this.rejectCallback) {
				this.rejectCallback(new Error('OAuth callback timed out after 5 minutes'));
			}
			this.cleanup();
		}, 5 * 60_000);

		const { url } = await this.oauth.authorize({
			target: { type: 'account', identifier: identifier as any },
			redirectUri,
		});
		window.open(url.href, '_blank');

		new Notice('Continue login in the browser')

		const params = await deferred;
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}

		const { session } = await this.oauth.callback(params, { redirectUri });
		// Clean up server after a short delay
		setTimeout(() => this.cleanup(), 2000);
		return session;
	}

	private cleanup(): void {
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
