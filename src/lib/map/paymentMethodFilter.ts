import type { Place } from "$lib/types";

// Legacy embed contract restored (#1269): bare URL params (?onchain&lightning&nfc)
// narrow the map to places accepting each method — AND across params, presence
// alone counts (the old Leaflet map filtered markers on load exactly this way).
// This module feeds that constraint into selectVisiblePlaces so pins, lists,
// chip counts, and search can never disagree.

export const PAYMENT_METHODS = ["onchain", "lightning", "nfc"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// URL param → OSM tag field on Place. `nfc` is the legacy param name for
// payment:lightning_contactless (kept short in the Embedding wiki contract).
const PAYMENT_METHOD_TAG: Record<
	PaymentMethod,
	| "osm:payment:onchain"
	| "osm:payment:lightning"
	| "osm:payment:lightning_contactless"
> = {
	onchain: "osm:payment:onchain",
	lightning: "osm:payment:lightning",
	nfc: "osm:payment:lightning_contactless",
};

// The tag fields only (all optional on Place). Accepting this narrow shape —
// which both a full Place and a lean API row satisfy — lets the closed-panel
// badge count (fetchCountOnly) reuse the predicate without pretending its
// id+tags rows are full Places.
export type PaymentTaggedPlace = Pick<
	Place,
	(typeof PAYMENT_METHOD_TAG)[PaymentMethod]
>;

// Presence-based parse matching the legacy behavior: ?onchain&lightning has no
// values, ?nfc=1 or even ?nfc= all count. No recognized params → null (off).
export const parsePaymentMethodsParam = (
	params: URLSearchParams,
): ReadonlySet<PaymentMethod> | null => {
	const selected = PAYMENT_METHODS.filter((method) => params.has(method));
	return selected.length > 0 ? new Set(selected) : null;
};

export const serializePaymentMethodsParam = (
	methods: ReadonlySet<PaymentMethod>,
): string => PAYMENT_METHODS.filter((method) => methods.has(method)).join(",");

export type PaymentTagState = "yes" | "no" | "unknown";

// An OSM payment tag has three states, and absent is by far the most common:
// 2,519 of 29,571 live places carry no payment tag at all (measured
// 2026-09-20). Reading absence as a refusal hid every one of them from every
// filtered view (#1423) — "nobody has recorded this" is not "this place does
// not accept it". Values are untrusted wire data: `only` is OSM's strongest
// yes (that method and nothing else), and anything unrecognized — live data
// holds `y`, `yed`, `yno`, a date, an email address — records nothing usable,
// which again is not a refusal.
export const readPaymentTag = (value: string | undefined): PaymentTagState => {
	switch (value?.trim().toLowerCase()) {
		case "yes":
		case "only":
			return "yes";
		case "no":
			return "no";
		default:
			return "unknown";
	}
};

// Why the filter kept or dropped a place. "no" is a recorded refusal;
// "unknown" is missing evidence, which is actionable — it invites someone to
// verify — and is the number the panel reports rather than hides.
export type PaymentFilterState = "match" | "no" | "unknown";

// AND semantics: a place must accept EVERY selected method.
export const placePaymentFilterState = (
	place: PaymentTaggedPlace,
	methods: ReadonlySet<PaymentMethod>,
): PaymentFilterState => {
	let unknown = false;
	for (const method of methods) {
		const state = readPaymentTag(place[PAYMENT_METHOD_TAG[method]]);
		// A refusal on any selected method settles it, whatever the others
		// say: the place was checked, so it is not a verification lead.
		if (state === "no") return "no";
		if (state === "unknown") unknown = true;
	}
	return unknown ? "unknown" : "match";
};

// The result set stays evidence-based — only a recorded yes matches — so the
// embed contract keeps its promise. The unknowns it drops are counted by
// applyPaymentMethodFilter and reported instead of vanishing silently.
export const placeMatchesPaymentMethods = (
	place: PaymentTaggedPlace,
	methods: ReadonlySet<PaymentMethod>,
): boolean => placePaymentFilterState(place, methods) === "match";

// Filter and count in one pass: the matches, plus how many of the drops were
// unknowns rather than refusals. Both the selectVisiblePlaces pipeline and
// the lean count badge go through this, so no surface can report a different
// number of excluded unknowns than another.
export const applyPaymentMethodFilter = <T extends PaymentTaggedPlace>(
	places: T[],
	methods: ReadonlySet<PaymentMethod>,
): { matched: T[]; unknown: number } => {
	const matched: T[] = [];
	let unknown = 0;
	for (const place of places) {
		const state = placePaymentFilterState(place, methods);
		if (state === "match") matched.push(place);
		else if (state === "unknown") unknown++;
	}
	return { matched, unknown };
};
