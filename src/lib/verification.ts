import type { Place } from "$lib/types";

// Memoize verified date calculation - recompute only once per day
let cachedVerifiedDate: number | null = null;
let cachedDay: number | null = null;

export function calcVerifiedDate(): number {
	const today = new Date().getDate();
	if (cachedVerifiedDate !== null && cachedDay === today) {
		return cachedVerifiedDate;
	}

	const verifiedDate = new Date();
	const previousYear = verifiedDate.getFullYear() - 1;
	cachedVerifiedDate = verifiedDate.setFullYear(previousYear);
	cachedDay = today;
	return cachedVerifiedDate;
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
