import type { ZoomBehavior } from "$lib/map/viewport";

export type NearbyListStatus =
	| "loading"
	| "below-floor"
	| "error"
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
// - error surfaces only when there is nothing to render: a failed refresh
//   with stale rows still showing stays 'ok'/'truncated' (the toast already
//   reported the failure; replacing real data with an error card would be
//   a regression), but a failure with an empty list must not masquerade as
//   "empty" or as a stale too-dense claim.
export function deriveNearbyListStatus(input: {
	behavior: ZoomBehavior;
	isLoading: boolean;
	hasError: boolean;
	merchantCount: number;
	totalCount: number;
}): NearbyListStatus {
	if (input.isLoading) return "loading";
	if (input.behavior === "none") return "below-floor";
	if (input.hasError && input.merchantCount === 0) return "error";
	if (input.merchantCount === 0 && input.totalCount > 0) return "too-dense";
	if (input.merchantCount === 0) return "empty";
	if (input.totalCount > input.merchantCount) return "truncated";
	return "ok";
}
