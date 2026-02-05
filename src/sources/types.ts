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
	getAttachedNotes?(): Array<{ uri: string; text: string }>;
}

export interface SourceFilter {
	type: string;
	value: string;
	label?: string;
}

export interface DataSource {
	readonly name: "semble" | "bookmark" | "margin";
	fetchItems(filters: SourceFilter[], plugin: AtmospherePlugin): Promise<ATBookmarkItem[]>;
	getAvailableFilters(): Promise<SourceFilter[]>;
	renderFilterUI(container: HTMLElement, activeFilters: Map<string, SourceFilter>, onChange: () => void, plugin: AtmospherePlugin): void;
}
