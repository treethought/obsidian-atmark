import type { Client } from "@atcute/client";
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

export async function getRecord(client: Client, repo: string, collection: string, rkey: string) {
	return await client.get("com.atproto.repo.getRecord", {
		params: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
		},
	});
}

export async function deleteRecord(client: Client, repo: string, collection: string, rkey: string) {
	return await client.post("com.atproto.repo.deleteRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
		},
	});
}

export async function putRecord(client: Client, repo: string, collection: string, rkey: string, record: any) {
	return await client.post("com.atproto.repo.putRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
			record,
		},
	});
}

export async function getProfile(client: Client, actor: string) {
	return await client.get("app.bsky.actor.getProfile", {
		params: { actor: actor as ActorIdentifier },
	});
}
