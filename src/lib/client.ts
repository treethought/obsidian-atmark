import { Client, CredentialManager, simpleFetchHandler } from "@atcute/client";
import { type ActorIdentifier } from "@atcute/lexicons";
import { resolveActor } from "./identity";
import { isActorIdentifier } from "@atcute/lexicons/syntax";

const DEFAULT_SERVICE = "https://bsky.social";

export interface Credentials {
	identifier: string;
	password: string;
}

export async function getAuthClient(creds: Credentials): Promise<Client> {
	let actor = await resolveActor(creds.identifier as ActorIdentifier);
	const service = actor.pds || DEFAULT_SERVICE;
	const manager = new CredentialManager({ service });
	await manager.login(creds);
	return new Client({ handler: manager });
}

export async function getPublicClient(identifier: string): Promise<Client> {
	if (isActorIdentifier(identifier)) {
		let actor = await resolveActor(identifier);
		const service = actor.pds || DEFAULT_SERVICE;
		return new Client({ handler: simpleFetchHandler({ service }) });
	}
	throw new Error("Invalid actor identifier: " + JSON.stringify(identifier));
}

