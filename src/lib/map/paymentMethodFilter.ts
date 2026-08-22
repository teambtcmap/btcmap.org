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

// AND semantics: a place must accept EVERY selected method.
export const placeMatchesPaymentMethods = (
	place: PaymentTaggedPlace,
	methods: ReadonlySet<PaymentMethod>,
): boolean => {
	for (const method of methods) {
		if (place[PAYMENT_METHOD_TAG[method]] !== "yes") return false;
	}
	return true;
};
