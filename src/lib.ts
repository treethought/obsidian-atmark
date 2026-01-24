import type { Client } from "@atcute/client";
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

export async function getProfile(client: Client, actor: string) {
	return await client.get("app.bsky.actor.getProfile", {
		params: { actor: actor as ActorIdentifier },
	});
}

export async function getCollections(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.collection" as Nsid,
			limit: 100,
		},
	});
}

export async function getCards(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.card" as Nsid,
			limit: 100,
		},
	});
}

export async function getCollectionLinks(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.collectionLink" as Nsid,
			limit: 100,
		},
	});
}

export async function getRecord(client: Client, repo: string, collection: string, rkey: string) {
	return await client.get("com.atproto.repo.getRecord", {
		params: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
		},
	});
}
