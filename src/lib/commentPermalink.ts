// Per-comment permalinks on the merchant page: the date on each comment links
// to #comment-<id>, and arriving with that hash scrolls the comment into view
// (the i18n loading gate renders content after load, so the browser's native
// anchor scroll misses on a fresh page load).

export const commentDomId = (id: number): string => `comment-${id}`;

// Parse a location.hash into the comment DOM id it targets. Anything that is
// not exactly #comment-<digits> is a miss — notably the existing #comments
// tab deep-link from the map drawer.
export const commentAnchorFromHash = (hash: string): string | null =>
	/^#comment-\d+$/.test(hash) ? hash.slice(1) : null;
