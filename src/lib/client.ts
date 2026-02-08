import { Client, FetchHandlerObject, simpleFetchHandler } from "@atcute/client";
import { resolveActor } from "./identity";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import { ResolvedActor } from "@atcute/identity-resolver";
import { OAuthHandler, } from "./oauth/oauth";
import { OAuthUserAgent } from "@atcute/oauth-browser-client";

export class ATClient extends Client {
	private hh: Handler;
	private oauth: OAuthHandler;
	actor?: ResolvedActor;

	constructor() {
		const hh = new Handler();
		super({ handler: hh });
		this.oauth = new OAuthHandler();
		this.hh = hh;
	}

	get loggedIn(): boolean {
		return !!this.hh.agent && !!this.actor;
	}

	async login(identifier: string): Promise<void> {
		const session = await this.oauth.authorize(identifier);
		this.hh.agent = new OAuthUserAgent(session);
		const did = this.hh.agent?.session.info.sub;
		if (did) {
			this.actor = await this.hh.getActor(did);
		}
	}

	async restoreSession(did: string): Promise<void> {
		const session = await this.oauth.restore(did);
		this.hh.agent = new OAuthUserAgent(session);
		this.actor = await this.hh.getActor(did);
	}

	async logout(identifier: string): Promise<void> {
		await this.oauth.revoke(identifier);
		this.hh.agent = undefined;
		this.actor = undefined;
	}

	async getActor(identifier: string): Promise<ResolvedActor> {
		return this.hh.getActor(identifier);
	}

	clearCache(): void {
		this.hh.clearCache();
	}

	handleOAuthCallback(params: URLSearchParams): void {
		this.oauth.handleCallback(params);
	}
}

/**
 * Custom handler that wraps OAuthUserAgent and adds PDS routing logic
 */
export class Handler implements FetchHandlerObject {
	cache: Cache;
	agent?: OAuthUserAgent;

	constructor() {
		this.cache = new Cache(5 * 60 * 1000); // 5 minutes TTL
	}

	async getActor(identifier: string): Promise<ResolvedActor> {
		const key = `actor:${identifier}`;
		const cached = this.cache.get<ResolvedActor>(key);
		if (cached) {
			return cached;
		}
		if (isActorIdentifier(identifier)) {
			try {
				const res = await resolveActor(identifier);
				this.cache.set(key, res);
				return res;
			} catch (e) {
				throw new Error(`Failed to resolve actor ${identifier}:` + JSON.stringify(e));
			}
		} else {
			throw new Error("Invalid actor identifier: " + identifier);
		}
	}

	async getPDS(pathname: string): Promise<string | null> {
		const url = new URL(pathname, "https://placeholder");
		const repo = url.searchParams.get("repo");
		if (!repo) {
			return null;
		}

		const own = (repo === this.agent?.session.info.sub);
		if (!own) {
			// resolve to get user's PDS
			const actor = await this.getActor(repo);
			return actor.pds;
		}
		return null;
	}

	clearCache(): void {
		this.cache.clear();
	}

	async handle(pathname: string, init: RequestInit): Promise<Response> {
		const cacheKey = `${init?.method || "GET"}:${pathname}`;
		if (init?.method?.toLowerCase() === "get") {
			const cached = this.cache.get<Response>(cacheKey);
			if (cached) {
				return cached.clone();
			}
		}

		let resp: Response;

		const pds = await this.getPDS(pathname);
		if (pds) {
			// use configureable public fetch for external PDS
			const sfh = simpleFetchHandler({ service: pds });
			resp = await sfh(pathname, init);
		} else if (this.agent) {
			// oauth handler if we are logged in
			resp = await this.agent.handle(pathname, init);
		} else {
			// default public fetch to bsky
			const sfh = simpleFetchHandler({ service: "https://bsky.social" });
			resp = await sfh(pathname, init);
		}

		if (init?.method?.toLowerCase() === "get" && resp.ok) {
			this.cache.set(cacheKey, resp.clone());
		}
		return resp;
	}
}

class CacheEntry<T> {
	value: T;
	timestamp: number;
	constructor(value: T) {
		this.value = value;
		this.timestamp = Date.now();
	}
}

class Cache {
	#store = new Map<string, CacheEntry<unknown>>();
	#ttl: number;

	constructor(ttlMillis: number) {
		this.#ttl = ttlMillis;
	}

	get<T>(key: string): T | undefined {
		const entry = this.#store.get(key);
		if (entry) {
			if (Date.now() - entry.timestamp < this.#ttl) {
				return entry.value as T;
			} else {
				this.#store.delete(key);
			}
		}
		return undefined;
	}

	set<T>(key: string, value: T): void {
		this.#store.set(key, new CacheEntry(value));
	}

	clear(): void {
		this.#store.clear();
	}
}
