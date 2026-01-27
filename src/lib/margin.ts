import type { Client } from "@atcute/client";
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

export async function getMarginBookmarks(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "at.margin.bookmark" as Nsid,
			limit: 100,
		},
	});
}

export async function createMarginBookmark(
	client: Client,
	repo: string,
	source: string,
	title?: string,
	description?: string,
	tags?: string[]
) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "at.margin.bookmark" as Nsid,
			record: {
				$type: "at.margin.bookmark",
				source,
				title,
				description,
				tags,
				createdAt: new Date().toISOString(),
			},
		},
	});
}

export async function getMarginCollections(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "at.margin.collection" as Nsid,
			limit: 100,
		},
	});
}

export async function getMarginCollectionItems(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "at.margin.collectionItem" as Nsid,
			limit: 100,
		},
	});
}

export async function createMarginCollection(
	client: Client,
	repo: string,
	name: string,
	description?: string,
	icon?: string
) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "at.margin.collection" as Nsid,
			record: {
				$type: "at.margin.collection",
				name,
				description,
				icon,
				createdAt: new Date().toISOString(),
			},
		},
	});
}

export async function createMarginCollectionItem(
	client: Client,
	repo: string,
	annotationUri: string,
	collectionUri: string,
	position?: number
) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "at.margin.collectionItem" as Nsid,
			record: {
				$type: "at.margin.collectionItem",
				annotation: annotationUri,
				collection: collectionUri,
				position,
				createdAt: new Date().toISOString(),
			},
		},
	});
}
