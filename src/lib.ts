import { Record } from "@atcute/atproto/types/repo/listRecords";

export { getRecord, deleteRecord, putRecord, getProfile } from "./lib/atproto";

export {
	getSembleCollections as getCollections,
	createSembleCollection as createCollection,
	getSembleCards as getCards,
	createSembleNote as createNoteCard,
	createSembleUrlCard as createUrlCard,
	getSembleCollectionLinks as getCollectionLinks,
	createSembleCollectionLink as createCollectionLink,
} from "./lib/bookmarks/cosmik";

export { getBookmarks, createBookmark, getTags, createTag } from "./lib/bookmarks/community";

export {
	getMarginBookmarks,
	createMarginBookmark,
	getMarginCollections,
	getMarginCollectionItems,
	createMarginCollection,
	createMarginCollectionItem,
} from "./lib/bookmarks/margin";

export {
	getDocuments,
	createDocument,
	putDocument,
	getPublication,
	getPublications,
	getSubscribedPublications,
	createPublication,
} from "./lib/standardsite";

export { markdownToLeafletContent } from "./lib/standardsite/leaflet";
export { markdownToPcktContent } from "./lib/standardsite/pckt";
export { stripMarkdown } from "./lib/markdown";

export type ATRecord<T> = Record & { value: T };
