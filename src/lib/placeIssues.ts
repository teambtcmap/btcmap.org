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

// Canonical code order: verification-state codes by urgency, then
// missing_icon. Drives chip display order, URL serialization, and pin-color
// precedence.
export const DERIVED_ISSUE_CODES = [
	"outdated",
	"outdated_soon",
	"not_verified",
	"missing_icon",
] as const;

const ALL_CODES: ReadonlySet<DerivedIssueCode> = new Set(DERIVED_ISSUE_CODES);

// The one code a pin color can express. Verification-state codes are
// mutually exclusive, so the only conflict is <verification> + missing_icon
// — the verification state wins.
export function dominantIssue(
	codes: readonly DerivedIssueCode[],
): DerivedIssueCode | null {
	for (const code of DERIVED_ISSUE_CODES) {
		if (codes.includes(code)) return code;
	}
	return null;
}

// "?issues=none": every chip toggled off — an explicit empty selection that
// must survive a reload, distinct from bare ?issues (= all).
const NONE_SENTINEL = "none";

// ?issues value → selected categories. Bare param ("" or null) and
// all-garbage values degrade to every code, preserving the original
// presence-only contract for existing deep links.
export function parseIssuesParam(
	raw: string | null,
): ReadonlySet<DerivedIssueCode> {
	if (raw?.trim() === NONE_SENTINEL) return new Set();
	const valid = (raw ?? "")
		.split(",")
		.map((c) => c.trim())
		.filter((c): c is DerivedIssueCode =>
			(DERIVED_ISSUE_CODES as readonly string[]).includes(c),
		);
	return valid.length ? new Set(valid) : ALL_CODES;
}

// Inverse of parseIssuesParam: full set → "" (bare ?issues), empty set →
// the none sentinel, subset → csv in canonical order so equal selections
// produce identical URLs.
export function serializeIssuesParam(
	selected: ReadonlySet<DerivedIssueCode>,
): string {
	if (selected.size === ALL_CODES.size) return "";
	if (selected.size === 0) return NONE_SENTINEL;
	return DERIVED_ISSUE_CODES.filter((c) => selected.has(c)).join(",");
}

export function placeMatchesIssueCodes(
	place: Partial<Pick<Place, "verified_at" | "icon">>,
	selected: ReadonlySet<DerivedIssueCode>,
	now?: number,
): boolean {
	return derivePlaceIssues(place, now).some((c) => selected.has(c));
}

export function countIssuesByCode(
	places: readonly Partial<Pick<Place, "verified_at" | "icon">>[],
	now?: number,
): Record<DerivedIssueCode, number> {
	const counts = Object.fromEntries(
		DERIVED_ISSUE_CODES.map((code) => [code, 0]),
	) as Record<DerivedIssueCode, number>;
	for (const place of places) {
		for (const code of derivePlaceIssues(place, now)) {
			counts[code]++;
		}
	}
	return counts;
}
