import { describe, expect, it } from "vitest";

import { derivePlaceIssues, placeHasIssues } from "./placeIssues";

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
