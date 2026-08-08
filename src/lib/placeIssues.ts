import type { Place } from "$lib/types";

// Client-side mirror of btcmap-api's per-place issue generation, for the
// /map?issues worklist. The server only serves issues per-area (v4
// place-issues requires area_id, and rows carry OSM identity rather than a
// place id), so world-scale issue detection derives the same codes from
// fields the client already syncs: verified_at (lazy-enriched) and icon.
//
// Boundaries are calibrated against the API's own per-area output
// (2026-08: DE and CH match exactly, all four codes — see #921). If counts
// ever drift from area pages, recalibrate here rather than patching call
// sites. Tag-lint codes (invalid_tag_value etc.) are server-only knowledge
// and deliberately out of scope; none appeared in any sampled area. When
// btcmap-api grows an `issues` field on /v4/places, this module is the
// single swap point: keep the interface, replace the derivation.
export type DerivedIssueCode =
	| "not_verified"
	| "outdated"
	| "outdated_soon"
	| "missing_icon";

const DAY_MS = 86_400_000;
// Strictly more than a year since verification. Day-floored: a place at
// exactly 365 days is not yet outdated, matching the server boundary.
const OUTDATED_AFTER_DAYS = 365;
// Strictly more than 275 days — day-floored ages 276..365, the last 90
// days before crossing the outdated boundary.
const OUTDATED_SOON_AFTER_DAYS = 275;

export function derivePlaceIssues(
	place: Partial<Pick<Place, "verified_at" | "icon">>,
	now: number = Date.now(),
): DerivedIssueCode[] {
	const codes: DerivedIssueCode[] = [];
	const parsed = place.verified_at ? Date.parse(place.verified_at) : Number.NaN;
	if (Number.isNaN(parsed)) {
		codes.push("not_verified");
	} else {
		const ageDays = Math.floor((now - parsed) / DAY_MS);
		if (ageDays > OUTDATED_AFTER_DAYS) {
			codes.push("outdated");
		} else if (ageDays > OUTDATED_SOON_AFTER_DAYS) {
			codes.push("outdated_soon");
		}
	}
	// The pipeline's placeholder icon is what the server flags as missing.
	if (!place.icon || place.icon === "question_mark") {
		codes.push("missing_icon");
	}
	return codes;
}

export function placeHasIssues(
	place: Partial<Pick<Place, "verified_at" | "icon">>,
	now?: number,
): boolean {
	return derivePlaceIssues(place, now).length > 0;
}
