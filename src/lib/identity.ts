import type { ActorIdentifier } from "@atcute/lexicons";
import {
	CompositeHandleResolver,
	DohJsonHandleResolver,
	LocalActorResolver,
	WellKnownHandleResolver,
	type ActorResolver,
	type ResolveActorOptions,
	type ResolvedActor,
} from '@atcute/identity-resolver';

import {
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from '@atcute/identity-resolver';

import { Client, ok, simpleFetchHandler } from "@atcute/client";


const handleResolver = new CompositeHandleResolver({
	methods: {
		dns: new DohJsonHandleResolver({ dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query' }),
		http: new WellKnownHandleResolver(),
	},
});

const didResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
});

const localActorResolver = new LocalActorResolver({
	handleResolver,
	didDocumentResolver: didResolver,
});

export class SlingshotActorResolver implements ActorResolver {
	private client: Client;

	constructor() {
		this.client = new Client({
			handler: simpleFetchHandler({
				service: "https://slingshot.microcosm.blue",
				// fetch: obsidianFetch
			})
		});
	}

	async resolve(actor: ActorIdentifier, options?: ResolveActorOptions): Promise<ResolvedActor> {
		const resolved = await ok(
			this.client.get("blue.microcosm.identity.resolveMiniDoc", {
				params: { identifier: actor },
				signal: options?.signal,
			})
		);

		return {
			did: resolved.did,
			handle: resolved.handle,
			pds: resolved.pds,
		};
	}
}

class CompositeActorResolver implements ActorResolver {
	private slingshotResolver: SlingshotActorResolver;
	private localResolver: LocalActorResolver;

	constructor(slingshotResolver: SlingshotActorResolver, localResolver: LocalActorResolver) {
		this.slingshotResolver = slingshotResolver;
		this.localResolver = localResolver;
	}

	async resolve(actor: ActorIdentifier, options?: ResolveActorOptions): Promise<ResolvedActor> {
		try {
			const resolved = await this.slingshotResolver.resolve(actor, options);
			return resolved;
		} catch (error) {
			console.warn("Slingshot actor resolution failed, falling back to local resolver:", error);
			return await this.localResolver.resolve(actor, options);
		}
	}
}

const slingshotResolver = new SlingshotActorResolver();

export const compositeResolver = new CompositeActorResolver(slingshotResolver, localActorResolver);

export async function resolveActor(identifier: ActorIdentifier) {
	return compositeResolver.resolve(identifier);
}


