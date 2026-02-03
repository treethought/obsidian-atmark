import type { ActorIdentifier } from "@atcute/lexicons";
import {
	CompositeHandleResolver,
	DohJsonHandleResolver,
	LocalActorResolver,
	WellKnownHandleResolver,
} from '@atcute/identity-resolver';

import {
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from '@atcute/identity-resolver';

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

const actorResolver = new LocalActorResolver({
	handleResolver,
	didDocumentResolver: didResolver,
});

export async function resolveActor(identifier: ActorIdentifier) {
	return actorResolver.resolve(identifier);
}


