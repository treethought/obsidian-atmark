import { Record } from "@atcute/atproto/types/repo/listRecords";

export { getRecord, deleteRecord, putRecord, getProfile } from "./lib/atproto";

export {
	getSembleCollections,
	createSembleCollection,
	getSembleCards,
	createSembleNote,
	createSembleUrlCard,
	getSembleCollectionLinks,
	createSembleCollectionLink,
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
	getPublicationDocuments,
	createDocument,
	putDocument,
	getPublication,
	getPublications,
	getSubscribedPublications,
	createPublication,
	buildDocumentUrl
} from "./lib/standardsite";

export {
	stripMarkdown,
	markdownToLeafletContent,
	markdownToPcktContent,
} from "./lib/markdown";

export type ATRecord<T> = Record & { value: T };
