import { describe, expect, it } from "vitest";

import {
	countIssuesByCode,
	DERIVED_ISSUE_CODES,
	derivePlaceIssues,
	dominantIssue,
	parseIssuesParam,
	placeHasIssues,
	placeMatchesIssueCodes,
	serializeIssuesParam,
} from "./placeIssues";

// Fixed clock so the day-boundary assertions can't flake.
const NOW = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

describe("derivePlaceIssues", () => {
	it("returns nothing for a fresh, iconed place", () => {
		expect(
			derivePlaceIssues({ verified_at: daysAgo(30), icon: "restaurant" }, NOW),
		).toEqual([]);
	});

	it("flags a place without a verification date as not_verified", () => {
		expect(derivePlaceIssues({ icon: "restaurant" }, NOW)).toEqual([
			"not_verified",
		]);
	});

	it("treats an unparseable date as not_verified", () => {
		expect(
			derivePlaceIssues({ verified_at: "not-a-date", icon: "restaurant" }, NOW),
		).toEqual(["not_verified"]);
	});

	// The exact boundaries the API oracle confirmed (DE + CH, all codes
	// matching): outdated strictly past 365 days, outdated_soon strictly
	// past 275, both day-floored.
	it("day-floors the outdated boundary at strictly more than 365 days", () => {
		expect(
			derivePlaceIssues({ verified_at: daysAgo(366), icon: "cafe" }, NOW),
		).toEqual(["outdated"]);
		expect(
			derivePlaceIssues({ verified_at: daysAgo(365), icon: "cafe" }, NOW),
		).toEqual(["outdated_soon"]);
		// 365 days plus a few hours still floors to 365 — not yet outdated.
		expect(
			derivePlaceIssues(
				{
					verified_at: new Date(NOW - 365.5 * DAY_MS).toISOString(),
					icon: "cafe",
				},
				NOW,
			),
		).toEqual(["outdated_soon"]);
	});

	it("day-floors the outdated_soon boundary at strictly more than 275 days", () => {
		expect(
			derivePlaceIssues({ verified_at: daysAgo(276), icon: "cafe" }, NOW),
		).toEqual(["outdated_soon"]);
		expect(
			derivePlaceIssues({ verified_at: daysAgo(275), icon: "cafe" }, NOW),
		).toEqual([]);
	});

	it("flags a missing or placeholder icon", () => {
		expect(derivePlaceIssues({ verified_at: daysAgo(30) }, NOW)).toEqual([
			"missing_icon",
		]);
		expect(
			derivePlaceIssues({ verified_at: daysAgo(30), icon: "" }, NOW),
		).toEqual(["missing_icon"]);
		expect(
			derivePlaceIssues(
				{ verified_at: daysAgo(30), icon: "question_mark" },
				NOW,
			),
		).toEqual(["missing_icon"]);
	});

	it("combines independent codes", () => {
		expect(
			derivePlaceIssues(
				{ verified_at: daysAgo(400), icon: "question_mark" },
				NOW,
			),
		).toEqual(["outdated", "missing_icon"]);
		expect(derivePlaceIssues({}, NOW)).toEqual([
			"not_verified",
			"missing_icon",
		]);
	});

	it("never flags a future verification date as outdated", () => {
		expect(
			derivePlaceIssues({ verified_at: daysAgo(-10), icon: "cafe" }, NOW),
		).toEqual([]);
	});
});

describe("placeHasIssues", () => {
	it("mirrors derivePlaceIssues non-emptiness", () => {
		expect(
			placeHasIssues({ verified_at: daysAgo(30), icon: "restaurant" }, NOW),
		).toBe(false);
		expect(
			placeHasIssues({ verified_at: daysAgo(400), icon: "cafe" }, NOW),
		).toBe(true);
		expect(placeHasIssues({ icon: "cafe" }, NOW)).toBe(true);
	});
});

describe("dominantIssue", () => {
	// Verification-state codes are mutually exclusive, so the only real
	// conflict is <verification code> + missing_icon — verification wins.
	it("prefers the verification-state code over missing_icon", () => {
		expect(dominantIssue(["outdated", "missing_icon"])).toBe("outdated");
		expect(dominantIssue(["not_verified", "missing_icon"])).toBe(
			"not_verified",
		);
		expect(dominantIssue(["outdated_soon", "missing_icon"])).toBe(
			"outdated_soon",
		);
	});

	it("passes through a single code and handles none", () => {
		expect(dominantIssue(["missing_icon"])).toBe("missing_icon");
		expect(dominantIssue(["outdated"])).toBe("outdated");
		expect(dominantIssue([])).toBeNull();
	});
});

describe("parseIssuesParam", () => {
	it("treats a bare ?issues (empty value) as all codes", () => {
		expect(parseIssuesParam("")).toEqual(new Set(DERIVED_ISSUE_CODES));
		expect(parseIssuesParam(null)).toEqual(new Set(DERIVED_ISSUE_CODES));
	});

	it("parses a csv subset, ignoring unknown codes and whitespace", () => {
		expect(parseIssuesParam("outdated,not_verified")).toEqual(
			new Set(["outdated", "not_verified"]),
		);
		expect(parseIssuesParam(" outdated , bogus ,missing_icon")).toEqual(
			new Set(["outdated", "missing_icon"]),
		);
	});

	it("degrades an all-garbage value to all codes (presence rule)", () => {
		expect(parseIssuesParam("bogus,wat")).toEqual(new Set(DERIVED_ISSUE_CODES));
	});

	it("parses the none sentinel as an explicit empty selection", () => {
		expect(parseIssuesParam("none")).toEqual(new Set());
	});
});

describe("serializeIssuesParam", () => {
	it("serializes the full set as the bare param value", () => {
		expect(serializeIssuesParam(new Set(DERIVED_ISSUE_CODES))).toBe("");
	});

	it("serializes subsets as csv in canonical order", () => {
		expect(serializeIssuesParam(new Set(["not_verified", "outdated"]))).toBe(
			"outdated,not_verified",
		);
	});

	it("round-trips through parseIssuesParam, empty selection included", () => {
		const subset = new Set([
			"outdated_soon",
			"missing_icon",
		] as const) as ReadonlySet<import("./placeIssues").DerivedIssueCode>;
		expect(parseIssuesParam(serializeIssuesParam(subset))).toEqual(subset);
		const empty = new Set() as ReadonlySet<
			import("./placeIssues").DerivedIssueCode
		>;
		expect(serializeIssuesParam(empty)).toBe("none");
		expect(parseIssuesParam(serializeIssuesParam(empty))).toEqual(empty);
	});
});

describe("placeMatchesIssueCodes", () => {
	it("matches when any derived code is selected", () => {
		const selected = new Set(["outdated"] as const);
		expect(
			placeMatchesIssueCodes(
				{ verified_at: daysAgo(400), icon: "question_mark" },
				selected,
				NOW,
			),
		).toBe(true);
		expect(
			placeMatchesIssueCodes(
				{ verified_at: daysAgo(30), icon: "question_mark" },
				selected,
				NOW,
			),
		).toBe(false);
	});

	it("never matches a clean place, even with all codes selected", () => {
		expect(
			placeMatchesIssueCodes(
				{ verified_at: daysAgo(30), icon: "cafe" },
				new Set(DERIVED_ISSUE_CODES),
				NOW,
			),
		).toBe(false);
	});
});

describe("countIssuesByCode", () => {
	it("counts each code across a list independently", () => {
		const counts = countIssuesByCode(
			[
				{ verified_at: daysAgo(400), icon: "question_mark" },
				{ verified_at: daysAgo(300), icon: "cafe" },
				{ icon: "cafe" },
				{ verified_at: daysAgo(30), icon: "cafe" },
			],
			NOW,
		);
		expect(counts).toEqual({
			outdated: 1,
			outdated_soon: 1,
			not_verified: 1,
			missing_icon: 1,
		});
	});
});
