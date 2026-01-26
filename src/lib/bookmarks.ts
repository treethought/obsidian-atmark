import type { Client } from "@atcute/client";
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

export async function getBookmarks(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "community.lexicon.bookmarks.bookmark" as Nsid,
			limit: 100,
		},
	});
}

export async function createBookmark(
	client: Client,
	repo: string,
	subject: string,
	title?: string,
	description?: string,
	tags?: string[]
) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "community.lexicon.bookmarks.bookmark" as Nsid,
			record: {
				$type: "community.lexicon.bookmarks.bookmark",
				subject,
				title,
				description,
				tags,
				createdAt: new Date().toISOString(),
			},
		},
	});
}

export async function getTags(client: Client, repo: string) {
	return await client.get("com.atproto.repo.listRecords", {
		params: {
			repo: repo as ActorIdentifier,
			collection: "com.kipclip.tag" as Nsid,
			limit: 100,
		},
	});
}

export async function createTag(client: Client, repo: string, value: string) {
	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "com.kipclip.tag" as Nsid,
			record: {
				$type: "com.kipclip.tag",
				value,
				createdAt: new Date().toISOString(),
			},
		},
	});
}
