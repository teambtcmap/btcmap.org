import type { Place } from "$lib/types";

// Returns the timestamp exactly 12 months before "now". Intentionally
// uncached: the previous module-scope cache keyed on Date.getDate()
// (day-of-month, 1-31) would return a stale value when a process
// crossed a month boundary on the same day number (e.g. May 15 → Jun
// 15). This bites both long-lived browser sessions and SSR workers.
// The computation is trivial, so just recompute.
export function calcVerifiedDate(): number {
	const d = new Date();
	d.setFullYear(d.getFullYear() - 1);
	return d.getTime();
}

// True if the given verification date is within the "recently verified"
// window (currently 12 months). Use this everywhere we render a recency
// state so summary and detail views can never disagree on the same date.
export function isRecentlyVerified(
	dateStr: string | undefined | null,
): boolean {
	if (!dateStr) return false;
	const parsed = Date.parse(dateStr);
	if (Number.isNaN(parsed)) return false;
	return parsed > calcVerifiedDate();
}

export function isUpToDate(merchant: Place | null): boolean {
	return isRecentlyVerified(merchant?.verified_at);
}

// Returns the place's OSM verification dates (most recent first).
// Intentionally uncached: an earlier version keyed a module-scope
// cache on `${id}:${updated_at}`, which collided when MerchantCard
// rendered the same record twice — first with the stripped MAP_SYNC
// shape (no OSM date tags), then with the enhanced COMPLETE_PLACE
// shape (tags present). The first call cached `[]` and the enhanced
// call hit that stale entry, leaving every area card stuck on
// "Not recently verified" even when the place had a fresh date.
export function verifiedArr(place: Place): string[] {
	const verified: string[] = [];

	if (place["osm:survey:date"] && Date.parse(place["osm:survey:date"])) {
		verified.push(place["osm:survey:date"]);
	}

	if (place["osm:check_date"] && Date.parse(place["osm:check_date"])) {
		verified.push(place["osm:check_date"]);
	}

	if (
		place["osm:check_date:currency:XBT"] &&
		Date.parse(place["osm:check_date:currency:XBT"])
	) {
		verified.push(place["osm:check_date:currency:XBT"]);
	}

	if (verified.length > 1) {
		verified.sort((a, b) => Date.parse(b) - Date.parse(a));
	}

	return verified;
}
