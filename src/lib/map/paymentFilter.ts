import type { Place } from "$lib/types";

// The embed payment-method deep link (?onchain&lightning&nfc — see the
// Embedding wiki page). Presence alone counts and multiple params AND
// together, matching the legacy Leaflet map (2b45107c) these params were
// lost from in the #398 rewrite (#1269). `nfc` maps to the
// payment:lightning_contactless tag.
export type PaymentMethodFilter = {
	onchain: boolean;
	lightning: boolean;
	nfc: boolean;
};

export const parsePaymentFilter = (
	searchParams: URLSearchParams,
): PaymentMethodFilter | null => {
	const filter = {
		onchain: searchParams.has("onchain"),
		lightning: searchParams.has("lightning"),
		nfc: searchParams.has("nfc"),
	};
	return filter.onchain || filter.lightning || filter.nfc ? filter : null;
};

// Strictly === "yes": live OSM data carries "no" and free-text noise in
// these tags, so truthiness would show places that explicitly refuse the
// method.
export const placeMatchesPaymentFilter = (
	place: Place,
	filter: PaymentMethodFilter,
): boolean =>
	(!filter.onchain || place["osm:payment:onchain"] === "yes") &&
	(!filter.lightning || place["osm:payment:lightning"] === "yes") &&
	(!filter.nfc || place["osm:payment:lightning_contactless"] === "yes");

// For computeVisibleSignature: "off" when inactive, otherwise a non-empty
// combination key ("onchain+lightning").
export const serializePaymentFilter = (
	filter: PaymentMethodFilter | null,
): string => {
	if (!filter) return "off";
	return [
		filter.onchain && "onchain",
		filter.lightning && "lightning",
		filter.nfc && "nfc",
	]
		.filter(Boolean)
		.join("+");
};
