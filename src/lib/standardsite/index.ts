import { ok, type Client } from "@atcute/client";
import type { ActorIdentifier, GenericUri, Nsid, ResourceUri } from "@atcute/lexicons";
import { parse, parseResourceUri } from "@atcute/lexicons";
import { ComAtprotoRepoCreateRecord, ComAtprotoRepoGetRecord, ComAtprotoRepoListRecords, ComAtprotoRepoPutRecord } from "@atcute/atproto";
import { Main as Document } from "@atcute/standard-site/types/document";
import { Main as Publication } from "@atcute/standard-site/types/publication";
import { Main as Subscription } from "@atcute/standard-site/types/graph/subscription";

import { ATRecord } from "lib";
import { SiteStandardDocument, SiteStandardGraphSubscription, SiteStandardPublication } from "@atcute/standard-site";

export function buildDocumentUrl(pubUrl: string, docUri: string, record: SiteStandardDocument.Main): string {
	const baseUrl = pubUrl.replace(/\/$/, '');

	// leaflet does not use path, url just uses rkey
	if (record.path === undefined || record.path === '') {
		const parsed = parseResourceUri(docUri)
		if (parsed.ok) {
			return `${baseUrl}/${parsed.value.rkey}`;
		}
		return ""
	}

	return `${baseUrl}/${record.path}`
}


export async function getPublicationDocuments(client: Client, repo: string, pubUri: ResourceUri) {
	const response = await ok(client.call(ComAtprotoRepoListRecords, {
		params: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.document" as Nsid,
			limit: 100,
		},
	}));

	const pubDocs = response.records.filter(record => {
		const parsed = parse(SiteStandardDocument.mainSchema, record.value);
		return parsed.site === pubUri;
	});

	return {
		...response,
		records: pubDocs.map(record => ({
			...record,
			value: parse(SiteStandardDocument.mainSchema, record.value),
		})) as ATRecord<Document>[],
	};
};

export async function createDocument(
	client: Client,
	repo: string,
	record: Document
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

export async function putDocument(
	client: Client,
	repo: string,
	uri: ResourceUri,
	record: Document,
) {
	const now = new Date().toISOString();
	record.updatedAt = now;

	if (!record.publishedAt) {
		record.publishedAt = now;
	}

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
	const response = await ok(client.call(ComAtprotoRepoListRecords, {
		params: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.publication" as Nsid,
			limit: 100,
		},
	}));
	const records: ATRecord<Publication>[] = response.records.map(record => ({
		...record,
		value: parse(SiteStandardPublication.mainSchema, record.value),
	}));

	return {
		...response,
		records,
	}
}


export async function getPublication(client: Client, uri: ResourceUri): Promise<ATRecord<Publication>> {
	const parsed = parseResourceUri(uri);
	if (!parsed.ok) {
		throw new Error(`Invalid URI: ${uri}`);
	}
	const resp = await ok(client.call(ComAtprotoRepoGetRecord, {
		params: {
			repo: parsed.value.repo,
			collection: parsed.value.collection as Nsid,
			rkey: parsed.value.rkey!,
		},
	}));

	return {
		uri: resp.uri,
		cid: resp.cid!,
		value: parse(SiteStandardPublication.mainSchema, resp.value)
	};
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
	const record: Publication = {
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

export async function getSubscriptions(client: Client, repo: string) {
	const response = await ok(client.call(ComAtprotoRepoListRecords, {
		params: {
			repo: repo as ActorIdentifier,
			collection: "site.standard.graph.subscription" as Nsid,
			limit: 100,
		},
	}));
	const records: ATRecord<Subscription>[] = response.records.map(record => ({
		...record,
		value: parse(SiteStandardGraphSubscription.mainSchema, record.value),
	}));

	return {
		...response,
		records,
	}
}

export async function getSubscribedPublications(client: Client, repo: string): Promise<ATRecord<Publication>[]> {
	const subsResp = await getSubscriptions(client, repo);
	const pubUris = subsResp.records.map(sub => sub.value.publication);

	let pubs: ATRecord<Publication>[] = [];
	for (const uri of pubUris) {
		try {
			const pubResp = await getPublication(client, uri);
			pubs.push(pubResp);
		} catch (e) {
			console.warn(`Failed to fetch publication at ${uri}:`, e);
		}
	}
	return pubs;
}

