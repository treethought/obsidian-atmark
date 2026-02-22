import type { Client } from "@atcute/client";
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

export async function getRecord(client: Client, repo: string, collection: string, rkey: string) {
	const resp = await client.get("com.atproto.repo.getRecord", {
		params: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
		},
	});
	if (!resp.ok) {
		throw new Error(`Failed to get record: ${resp.status} ${resp.data?.message || ""}`);
	}
	return resp
}

export async function deleteRecord(client: Client, repo: string, collection: string, rkey: string) {
	const resp = await client.post("com.atproto.repo.deleteRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
		},
	});
	if (!resp.ok) {
		throw new Error(`Failed to delete record: ${resp.status} ${resp.data?.message || ""}`);
	}
}

export async function putRecord<T = unknown>(client: Client, repo: string, collection: string, rkey: string, record: T) {
	const resp = await client.post("com.atproto.repo.putRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: collection as Nsid,
			rkey,
			record: record as unknown as { [key: string]: unknown },
		},
	});
	if (!resp.ok) {
		throw new Error(`Failed to put record: ${resp.status} ${resp.data?.message || ""}`);
	}
}

export async function getProfile(client: Client, actor: string) {
	return await client.get("app.bsky.actor.getProfile", {
		params: { actor: actor as ActorIdentifier },
	});
}
