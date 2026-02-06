import { Client, FetchHandlerObject, simpleFetchHandler } from "@atcute/client";
import { resolveActor } from "./identity";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import { ResolvedActor } from "@atcute/identity-resolver";
import type { OAuthSession } from "@atcute/oauth-node-client";

export class ATClient extends Client {
	hh: Handler;

	constructor(session: OAuthSession) {
		const hh = new Handler(session);
		super({ handler: hh });
		this.hh = hh;
	}

	get loggedIn(): boolean {
		return !!this.hh.session.did;
	}

	get session() {
		return { did: this.hh.session.did };
	}

	async getActor(identifier: string): Promise<ResolvedActor> {
		return this.hh.getActor(identifier);
	}
}

/**
 * Custom handler that wraps OAuthSession and adds PDS routing logic
 */
export class Handler implements FetchHandlerObject {
	session: OAuthSession;
	cache: Cache;

	constructor(session: OAuthSession) {
		this.session = session;
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
				console.error("Error resolving actor:", e);
				throw new Error("Failed to resolve actor: " + JSON.stringify(identifier));
			}
		} else {
			throw new Error("Invalid actor identifier: " + JSON.stringify(identifier));
		}
	}

	async getPDS(pathname: string): Promise<string | null> {
		const url = new URL(pathname, "https://placeholder");
		const repo = url.searchParams.get("repo");
		if (!repo) {
			return null;
		}

		const own = (repo === this.session.did);
		if (!own) {
			// resolve to get user's PDS
			const actor = await this.getActor(repo);
			return actor.pds;
		}
		return null;
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
			const sfh = simpleFetchHandler({ service: pds });
			resp = await sfh(pathname, init);
		} else {
			resp = await this.session.handle(pathname, init);
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
}
