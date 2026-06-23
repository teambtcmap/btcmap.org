import type { Place } from "$lib/types";

// Returns the timestamp exactly `years` before "now". Intentionally
// uncached: a previous module-scope cache keyed on Date.getDate()
// (day-of-month, 1-31) returned a stale value when a process crossed a
// month boundary on the same day number (e.g. May 15 → Jun 15). This bit
// both long-lived browser sessions and SSR workers. The computation is
// trivial, so just recompute.
export function calcVerifiedCutoff(years: number): number {
	const d = new Date();
	d.setFullYear(d.getFullYear() - years);
	return d.getTime();
}

// Timestamp 12 months before now — the "recently verified" window used by
// the merchant summary/detail badges.
export function calcVerifiedDate(): number {
	return calcVerifiedCutoff(1);
}

// True if the verification date is within `years` of now. A missing or
// unparseable date is never "within".
export function isVerifiedWithinYears(
	dateStr: string | undefined | null,
	years: number,
): boolean {
	if (!dateStr) return false;
	const parsed = Date.parse(dateStr);
	if (Number.isNaN(parsed)) return false;
	return parsed > calcVerifiedCutoff(years);
}

// True if the given verification date is within the "recently verified"
// window (12 months). Use this everywhere we render a recency state so
// summary and detail views can never disagree on the same date.
export function isRecentlyVerified(
	dateStr: string | undefined | null,
): boolean {
	return isVerifiedWithinYears(dateStr, 1);
}

export function isUpToDate(merchant: Place | null): boolean {
	return isRecentlyVerified(merchant?.verified_at);
}

// Filters to places verified within `years`; returns the list unchanged when
// `years` is null (the "Any" / off state). Places without a verified_at are
// excluded when a year filter is active, matching the Android app.
export function filterPlacesByRecency(
	places: Place[],
	years: number | null,
): Place[] {
	if (years == null) return places;
	return places.filter((p) => isVerifiedWithinYears(p.verified_at, years));
}
