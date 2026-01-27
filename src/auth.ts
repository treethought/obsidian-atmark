import { Client, CredentialManager, simpleFetchHandler } from "@atcute/client";

const DEFAULT_SERVICE = "https://bsky.social";

export interface Credentials {
	identifier: string;
	password: string;
	serviceUrl?: string;
}

export async function createAuthenticatedClient(creds: Credentials): Promise<Client> {
	const service = creds.serviceUrl || DEFAULT_SERVICE;
	const manager = new CredentialManager({ service });
	await manager.login(creds);
	return new Client({ handler: manager });
}

export function createPublicClient(serviceUrl?: string): Client {
	const service = serviceUrl || DEFAULT_SERVICE;
	return new Client({ handler: simpleFetchHandler({ service }) });
}
