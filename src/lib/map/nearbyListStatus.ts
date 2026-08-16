import type { ZoomBehavior } from "$lib/map/viewport";

export type NearbyListStatus =
	| "loading"
	| "below-floor"
	| "too-dense"
	| "empty"
	| "truncated"
	| "ok";

// The one interpretation of the nearby list's state (#1171). The store
// encodes "hidden because too dense" as residue — merchants blanked while
// totalCount is kept (fetchAndReplaceList's hideIfExceeds branch,
// fetchCountOnly) — and this function is the only place that residue is
// read back into a status. Order matters:
// - loading first, so a stale residue can't flash the zoom-in prompt
//   while a fetch is in flight (the old !isLoadingList guards);
// - behavior (not raw zoom) decides below-floor, because ?boosts/?issues
//   force local-markers at any zoom and must never see the prompt.
export function deriveNearbyListStatus(input: {
	behavior: ZoomBehavior;
	isLoading: boolean;
	merchantCount: number;
	totalCount: number;
}): NearbyListStatus {
	if (input.isLoading) return "loading";
	if (input.behavior === "none") return "below-floor";
	if (input.merchantCount === 0 && input.totalCount > 0) return "too-dense";
	if (input.merchantCount === 0) return "empty";
	if (input.totalCount > input.merchantCount) return "truncated";
	return "ok";
}
