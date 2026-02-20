import type AtmospherePlugin from "../main";

export interface ATBookmarkItem {
	render(container: HTMLElement): void;
	renderDetail(container: HTMLElement): void;
	canAddNotes(): boolean;
	canEdit(): boolean;
	openEditModal(onSuccess?: () => void): void;
	getUri(): string;
	getCid(): string;
	getCreatedAt(): string;
	getSource(): "semble" | "bookmark" | "margin";
	getCollections(): Array<{ uri: string; name: string }>;
	setCollections(collections: Array<{ uri: string; name: string }>): void;
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
