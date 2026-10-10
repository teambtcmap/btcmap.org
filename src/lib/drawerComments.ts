// Which comments the merchant drawer shows, and when to (re)fetch them.
// Kept out of the component so the "post a first comment" case is testable.

export type CommentsSyncPlan = "fetch" | "clear" | "keep";

type CommentsSyncState = {
	/** The merchant on screen; nullish while there is none yet. */
	id: number | null | undefined;
	/** `merchant.comments`, the count on the place record. */
	count: number | null | undefined;
	/** The merchant the list on screen was fetched for. */
	lastFetchedId: number | null;
	/** The merchant a comment was just posted for from this drawer. */
	addedForId: number | null;
};

/**
 * Decides what to do when the merchant or its comment count changes.
 *
 * The drawer's `merchant` is a snapshot that nothing refreshes after a paid
 * comment (`updateSinglePlace` only updates `$places`), so for a place that had
 * none its count stays 0. Without `addedForId` the "no comments" branch would
 * wipe the list just fetched.
 */
export const planCommentsSync = ({
	id,
	count,
	lastFetchedId,
	addedForId,
}: CommentsSyncState): CommentsSyncPlan => {
	if (!id) return "keep";
	const known = count || 0;
	if (known > 0) return id === lastFetchedId ? "keep" : "fetch";
	return addedForId === id ? "keep" : "clear";
};

/**
 * The count on the comments chip: the place record's, lifted to the length of
 * the list once that is loaded (the record is stale after a comment posted from
 * the drawer). Never lower than the record, so a failed or partial fetch can't
 * shrink it.
 */
export const displayCommentCount = (
	recordCount: number | null | undefined,
	loadedCount: number,
	loaded: boolean,
): number => {
	const record = recordCount || 0;
	return loaded ? Math.max(record, loadedCount) : record;
};
