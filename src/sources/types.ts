import type ATmarkPlugin from "../main";

export interface ATmarkItem {
	render(container: HTMLElement): void;
	renderDetail(container: HTMLElement): void;
	canAddNotes(): boolean;
	canEdit(): boolean;
	openEditModal(onSuccess?: () => void): void;
	getUri(): string;
	getCid(): string;
	getCreatedAt(): string;
	getSource(): "semble" | "bookmark";
}

export interface SourceFilter {
	type: string;
	value: any;
}

export interface DataSource {
	readonly name: "semble" | "bookmark";
	fetchItems(filters: SourceFilter[], plugin: ATmarkPlugin): Promise<ATmarkItem[]>;
	getAvailableFilters(): Promise<SourceFilter[]>;
	renderFilterUI(container: HTMLElement, activeFilters: Map<string, any>, onChange: () => void, plugin: ATmarkPlugin): void;
}
