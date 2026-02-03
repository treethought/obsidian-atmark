import type { Client } from "@atcute/client";
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

export async function getSembleCollections(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.collection" as Nsid,
			limit: 100,
		},
	});
}

export async function createSembleCollection(client: Client, repo: string, name: string, description: string) {
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

export async function getSembleCards(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.card" as Nsid,
			limit: 100,
		},
	});
}

export async function createSembleNote(client: Client, repo: string, text: string, parentCard?: { uri: string; cid: string }) {
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
				// Only set parentCard as per Semble documentation
				parentCard: parentCard ? { uri: parentCard.uri, cid: parentCard.cid } : undefined,
				createdAt: new Date().toISOString(),
			},
		},
	});
}

export async function createSembleUrlCard(client: Client, repo: string, url: string, metadata?: {
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

export async function getSembleCollectionLinks(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "network.cosmik.collectionLink" as Nsid,
			limit: 100,
		},
	});
}

export async function createSembleCollectionLink(
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
