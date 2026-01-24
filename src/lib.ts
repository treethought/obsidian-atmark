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


export async function createCollection(client: Client, repo: string, name: string, description: string) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.collection" as Nsid,
			validate: false,
			record: {
				$type: "network.cosmik.collection",
				name,
				description,
				accessType: "CLOSED",
				createdAt: new Date().toISOString(),
			},
		},
	});
}


export async function createNoteCard(client: Client, repo: string, text: string, originalCard?: { uri: string; cid: string }) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.card" as Nsid,
			record: {
				$type: "network.cosmik.card",
				type: "NOTE",
				content: {
					$type: "network.cosmik.card#noteContent",
					text,
				},
				originalCard: originalCard ? { uri: originalCard.uri, cid: originalCard.cid } : undefined,
				createdAt: new Date().toISOString(),
			},
		},
	});
}

export async function createUrlCard(client: Client, repo: string, url: string, metadata?: {
	title?: string;
	description?: string;
	imageUrl?: string;
	siteName?: string;
}) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.card" as Nsid,
			record: {
				$type: "network.cosmik.card",
				type: "URL",
				url,
				content: {
					$type: "network.cosmik.card#urlContent",
					url,
					metadata: metadata ? { $type: "network.cosmik.card#urlMetadata", ...metadata } : undefined,
				},
				createdAt: new Date().toISOString(),
			},
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

export async function createCollectionLink(
	client: Client,
	repo: string,
	cardUri: string,
	cardCid: string,
	collectionUri: string,
	collectionCid: string
) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.collectionLink" as Nsid,
			record: {
				$type: "network.cosmik.collectionLink",
				card: {
					uri: cardUri,
					cid: cardCid,
				},
				collection: {
					uri: collectionUri,
					cid: collectionCid,
				},
				addedAt: new Date().toISOString(),
				addedBy: repo,
				createdAt: new Date().toISOString(),
			},
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

export async function deleteRecord(client: Client, repo: string, collection: string, rkey: string) {
	return await client.post("com.atproto.repo.deleteRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
		},
	});
}
