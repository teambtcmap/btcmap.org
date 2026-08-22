import { derived } from "svelte/store";

import type { CategoryCounts, CategoryKey } from "$lib/categoryMapping";
import {
	countMerchantsByCategory,
	placeMatchesCategory,
} from "$lib/categoryMapping";
import type { PaymentMethod } from "$lib/map/paymentMethodFilter";
import {
	placeMatchesPaymentMethods,
	serializePaymentMethodsParam,
} from "$lib/map/paymentMethodFilter";
import type { VerifiedFilterYears } from "$lib/map/verifiedFilter";
import type { DerivedIssueCode } from "$lib/placeIssues";
import { placeMatchesIssueCodes, serializeIssuesParam } from "$lib/placeIssues";
import { places } from "$lib/store";
import type { Place } from "$lib/types";
import { isBoosted } from "$lib/utils";
import { filterPlacesByRecency } from "$lib/verification";

// The single decision pipeline for "which places are visible" (#1168). Every
// consumer — map pins, nearby list, search list, chip counts — derives from
// selectVisiblePlaces so no pair of sites can disagree again (the #1158-#1162
// bug class). The category predicate is placeMatchesCategory everywhere; the
// categoryMapping equivalence tests guard the legacy filterMerchantsByCategory
// until its remaining callers migrate.

export type VisibleSelectionInputs = {
	// Candidate rows: the bulk $places, the search results, or API radius rows.
	places: Place[];
	mode: "nearby" | "search";
	category: CategoryKey;
	recency: VerifiedFilterYears;
	// Row provenance, stated by the caller: API/search rows carry their own
	// verified_at, so the recency filter always applies; the bulk feed lacks
	// dates until enrichment, so its consumers gate on $verifiedDatesLoaded.
	// When false, the recency filter is deliberately inert rather than
	// classifying every row as unverified.
	recencyReady: boolean;
	// Callers resolve their own boost policy before calling (markers exempt
	// search mode; the nearby list always filters).
	boostsOnly: boolean;
	// The ?issues worklist mode: null when off; otherwise the selected issue
	// categories — a place stays visible when any of its derived codes (see
	// $lib/placeIssues) is selected. Applied pre-category so chip counts
	// describe the issue set. Callers resolve search exemption like boosts.
	issueCodes: ReadonlySet<DerivedIssueCode> | null;
	// Same readiness contract as recencyReady: issue derivation needs
	// verified_at, so bulk-feed consumers gate on $verifiedDatesLoaded and
	// the filter stays inert (rather than flagging every row as
	// not_verified) until enrichment lands.
	issuesReady: boolean;
	// The ?onchain&lightning&nfc embed filter (#1269): null when off; otherwise
	// a place stays visible only when it accepts EVERY selected method. Unlike
	// boosts/issues there is no search exemption — an embedded map must keep
	// its payment promise everywhere.
	paymentMethods: ReadonlySet<PaymentMethod> | null;
	// Same readiness contract as the two gates above: the bulk CDN feed and
	// MAP_SYNC rows lack payment tags entirely, so consumers gate on
	// $paymentTagsLoaded and stay inert rather than hiding every row. API
	// rows (search / radius LIST_ITEM) carry the tags natively and pass true.
	paymentsReady: boolean;
};

export type VisibleSelection = {
	// The final visible set: recency → issues → payments → category → boosts,
	// deleted rows dropped.
	selection: Place[];
	// The recency-filtered, PRE-category set — what chip counts and density
	// ceilings are computed on (a selected chip must not hide the other
	// chips' counts).
	preCategory: Place[];
	// Counts on preCategory, so chips describe exactly what selecting them
	// would show.
	counts: CategoryCounts;
	// The category after the auto-reset rule: a selected chip whose count
	// dropped to zero (while other places remain) snaps back to "all".
	effectiveCategory: CategoryKey;
};

export function selectVisiblePlaces(
	inputs: VisibleSelectionInputs,
): VisibleSelection {
	const live = inputs.places.filter((p) => !p.deleted_at);
	let preCategory = inputs.recencyReady
		? filterPlacesByRecency(live, inputs.recency)
		: live;
	const issueCodes = inputs.issueCodes;
	if (issueCodes && inputs.issuesReady) {
		preCategory = preCategory.filter((p) =>
			placeMatchesIssueCodes(p, issueCodes),
		);
	}
	if (inputs.paymentMethods && inputs.paymentsReady) {
		const methods = inputs.paymentMethods;
		preCategory = preCategory.filter((p) =>
			placeMatchesPaymentMethods(p, methods),
		);
	}
	const counts = countMerchantsByCategory(preCategory);

	const shouldReset =
		inputs.category !== "all" &&
		counts.all > 0 &&
		counts[inputs.category] === 0;
	const effectiveCategory = shouldReset ? "all" : inputs.category;

	let selection =
		effectiveCategory === "all"
			? preCategory
			: preCategory.filter((p) => placeMatchesCategory(p, effectiveCategory));
	if (inputs.boostsOnly) {
		selection = selection.filter((p) => Boolean(isBoosted(p)));
	}

	return { selection, preCategory, counts, effectiveCategory };
}

// Signature of everything that changes WHICH places are visible. String
// emissions are cheap to compare; consumers recompute the selection only when
// this changes, never on unrelated store ticks (loading flags, search
// keystrokes, enrichment merges). `revision` covers the candidate list's
// content — including in-place mutations a shape signature can't see.
export function computeVisibleSignature(
	inputs: Omit<VisibleSelectionInputs, "places">,
	revision: number,
	searchResultIds: string,
): string {
	return [
		inputs.mode,
		inputs.category,
		inputs.recency ?? "any",
		inputs.recencyReady,
		inputs.boostsOnly,
		// "" (bare/all) from the serializer must not collide with mode-off.
		inputs.issueCodes
			? serializeIssuesParam(inputs.issueCodes) || "all"
			: "off",
		inputs.issuesReady,
		inputs.paymentMethods
			? serializePaymentMethodsParam(inputs.paymentMethods)
			: "off",
		inputs.paymentsReady,
		revision,
		searchResultIds,
	].join("|");
}

// Bumps on EVERY $places publication — bulk sync, incremental merge, and the
// single-place mutation flows (boost confirmation, new comment count), whose
// in-place field changes no length/shape signature can detect. This replaces
// the lastUpdatedPlaceId handshake and the fragile source-order contract the
// map page previously needed for the same purpose: derived-store ordering is
// topological, not source-order.
let revisionCounter = 0;
export const placesRevision = derived(places, () => ++revisionCounter);
