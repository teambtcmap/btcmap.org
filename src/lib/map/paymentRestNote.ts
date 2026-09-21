import type { ZoomBehavior } from "$lib/map/viewport";

import { deriveNearbyListStatus } from "./nearbyListStatus";

// Whether a resting surface should carry the payment empty-state note
// (#1427). The mobile peek and the desktop floating bar both ask it, and
// the panel's own list body answers the same question for its expanded
// state, so the rule lives here instead of being spelled out three times
// with three chances to drift.
//
// Exactly the "empty" status and nothing else:
// - with results on screen it would be the standing tally #1424 rejected —
//   to a visitor looking for somewhere to spend, a count of untagged places
//   is noise;
// - with no unknowns excluded, the view really is empty and the plain
//   "nothing visible" message already says the true thing;
// - loading, below-floor, error and too-dense are not statements about
//   payment tags at all, and reading them as one would be the same lie of
//   omission in a new place.
export const shouldShowPaymentRestNote = (input: {
	behavior: ZoomBehavior;
	isLoading: boolean;
	hasError: boolean;
	merchantCount: number;
	totalCount: number;
	unknownPaymentCount: number;
}): boolean =>
	input.unknownPaymentCount > 0 && deriveNearbyListStatus(input) === "empty";
