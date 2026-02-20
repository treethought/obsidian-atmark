import type AtmospherePlugin from "../main";

export interface ATBookmarkItem {
	canAddNotes(): boolean;
	canAddTags(): boolean;
	canEdit(): boolean;
	openEditModal(onSuccess?: () => void): void;
	getUri(): string;
	getCid(): string;
	getCreatedAt(): string;
	getSource(): "semble" | "bookmark" | "margin";
	getTitle(): string | undefined;
	getDescription(): string | undefined;
	getImageUrl(): string | undefined;
	getUrl(): string | undefined;
	getSiteName(): string | undefined;
	getTags(): string[];
	getCollections(): Array<{ uri: string; name: string; source: string }>;
	setCollections(collections: Array<{ uri: string; name: string; source: string }>): void;
	getAttachedNotes?(): Array<{ uri: string; text: string }>;
}

export interface SourceFilter {
	value: string;
	label?: string;
}

export interface CollectionAssociation {
	record: string;
	collection: string;
}

export interface DataSource {
	readonly name: "semble" | "bookmark" | "margin";
	fetchItems(plugin: AtmospherePlugin, filteredCollections: Set<string>, filteredTags: Set<string>): Promise<ATBookmarkItem[]>;
	getAvailableCollections?(): Promise<SourceFilter[]>;
	getAvilableTags?(): Promise<SourceFilter[]>;
	getCollectionAssociations?(): Promise<CollectionAssociation[]>;
}
