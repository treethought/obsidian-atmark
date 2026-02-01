import { ok, type Client } from "@atcute/client";
import type { ActorIdentifier, GenericUri, Nsid, ResourceUri } from "@atcute/lexicons";
import { parseResourceUri } from "@atcute/lexicons";
import { ComAtprotoRepoCreateRecord, ComAtprotoRepoListRecords, ComAtprotoRepoPutRecord } from "@atcute/atproto";
import { SiteStandardDocument, SiteStandardPublication } from "lexicons";

export async function getDocuments(client: Client, repo: string) {
	const response = await ok(client.call(ComAtprotoRepoListRecords, {
		params: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.document" as Nsid,
			limit: 100,
		},
	}));

	return {
		...response,
		records: response.records as Array<{
			uri: string;
			cid: string;
			value: SiteStandardDocument.Main;
		}>,
	};
}

export async function createDocument(
	client: Client,
	repo: string,
	record: SiteStandardDocument.Main
) {
	const now = new Date().toISOString();
	if (!record.publishedAt) {
		record.publishedAt = now;
	}
	record.updatedAt = now;

	return await client.call(ComAtprotoRepoCreateRecord, {
		input: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.document" as Nsid,
			validate: false,
			record,
		},
	});
}

export async function updateDocument(
	client: Client,
	repo: string,
	uri: ResourceUri,
	record: SiteStandardDocument.Main
) {
	record.updatedAt = new Date().toISOString();

	const parsed = parseResourceUri(uri);
	if (!parsed.ok) {
		throw new Error(`Invalid URI: ${uri}`);
	}
	if (!parsed.value.rkey) {
		throw new Error(`URI does not contain rkey: ${uri}`);
	}

	return await client.call(ComAtprotoRepoPutRecord, {
		input: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.document" as Nsid,
			validate: false,
			record,
			rkey: parsed.value.rkey,
		},
	});
}
export async function getPublications(client: Client, repo: string) {
	return await ok(client.call(ComAtprotoRepoListRecords, {
		params: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.publication" as Nsid,
			limit: 100,
		},
	}));
}

export async function createPublication(
	client: Client,
	repo: string,
	name: string,
	url: GenericUri,
	options?: {
		description?: string;
		icon?: Blob;
		showInDiscover?: boolean;
	}
) {
	const record: SiteStandardPublication.Main = {
		$type: "site.standard.publication",
		name,
		url,
		description: options?.description,
		// icon: options?.icon,
		preferences: options?.showInDiscover !== undefined
			? {
				$type: "site.standard.publication#preferences",
				showInDiscover: options.showInDiscover,
			}
			: undefined,
	};

	return await client.post("com.atproto.repo.createRecord", {
		input: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.publication" as Nsid,
			validate: false,
			record,
		},
	});
}
