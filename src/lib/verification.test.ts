import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Place } from "$lib/types";

import {
	calcVerifiedDate,
	filterPlacesByRecency,
	isRecentlyVerified,
	isUpToDate,
	isVerifiedWithinYears,
} from "./verification";

const FIXED_NOW = new Date("2026-05-04T12:00:00Z").getTime();

const daysAgo = (days: number) =>
	new Date(FIXED_NOW - days * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(FIXED_NOW));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("calcVerifiedDate", () => {
	it("returns exactly one year before now", () => {
		const result = calcVerifiedDate();
		const oneYearAgo = new Date(FIXED_NOW);
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		expect(result).toBe(oneYearAgo.getTime());
	});

	// Regression: an earlier version cached the result keyed on
	// Date.getDate() (day-of-month, 1-31), so May 15 and Jun 15 collided
	// and a process spanning a month boundary on the same day number
	// returned a stale value. Verify the result tracks the current date
	// across consecutive calls under a moving clock.
	it("does not return a stale value across month boundaries", () => {
		vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
		const may = calcVerifiedDate();

		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		const june = calcVerifiedDate();

		expect(june).toBeGreaterThan(may);
		const expectedJune = new Date("2025-06-15T12:00:00Z").getTime();
		expect(june).toBe(expectedJune);
	});
});

describe("isRecentlyVerified", () => {
	it("returns true for a date well within the 12-month window", () => {
		expect(isRecentlyVerified(daysAgo(30))).toBe(true);
		expect(isRecentlyVerified(daysAgo(180))).toBe(true);
	});

	it("returns false for a date older than 12 months", () => {
		expect(isRecentlyVerified(daysAgo(400))).toBe(false);
	});

	// Regression for issue #964: AreaPage previously used
	// differenceInMonths(now, date) > 12 (whole-month rounding), so a place
	// 12 months + 15 days old looked "current" there while MerchantCard's
	// ms-precision check called it outdated. Both must agree.
	it("returns false for a date 12 months and 15 days old", () => {
		const date = new Date(FIXED_NOW);
		date.setFullYear(date.getFullYear() - 1);
		date.setDate(date.getDate() - 15);
		expect(isRecentlyVerified(date.toISOString())).toBe(false);
	});

	it("returns false for undefined, null, empty, or invalid input", () => {
		expect(isRecentlyVerified(undefined)).toBe(false);
		expect(isRecentlyVerified(null)).toBe(false);
		expect(isRecentlyVerified("")).toBe(false);
		expect(isRecentlyVerified("not-a-date")).toBe(false);
	});
});

describe("isUpToDate", () => {
	const place = (verified_at: string | undefined): Place =>
		({ id: 1, verified_at }) as unknown as Place;

	it("returns true when verified_at is within the window", () => {
		expect(isUpToDate(place(daysAgo(30)))).toBe(true);
	});

	it("returns false when verified_at is outside the window", () => {
		expect(isUpToDate(place(daysAgo(400)))).toBe(false);
	});

	it("returns false when merchant or verified_at is missing", () => {
		expect(isUpToDate(null)).toBe(false);
		expect(isUpToDate(place(undefined))).toBe(false);
	});
});

describe("isVerifiedWithinYears", () => {
	it("returns true within the N-year window", () => {
		expect(isVerifiedWithinYears(daysAgo(300), 1)).toBe(true);
		expect(isVerifiedWithinYears(daysAgo(600), 2)).toBe(true);
		expect(isVerifiedWithinYears(daysAgo(900), 3)).toBe(true);
	});

	it("returns false outside the N-year window", () => {
		expect(isVerifiedWithinYears(daysAgo(400), 1)).toBe(false);
		expect(isVerifiedWithinYears(daysAgo(800), 2)).toBe(false);
		expect(isVerifiedWithinYears(daysAgo(1200), 3)).toBe(false);
	});

	it("respects the exact boundary (2 years + 15 days is outside)", () => {
		const date = new Date(FIXED_NOW);
		date.setFullYear(date.getFullYear() - 2);
		date.setDate(date.getDate() - 15);
		expect(isVerifiedWithinYears(date.toISOString(), 2)).toBe(false);
	});

	it("returns false for missing or invalid input", () => {
		expect(isVerifiedWithinYears(undefined, 3)).toBe(false);
		expect(isVerifiedWithinYears(null, 3)).toBe(false);
		expect(isVerifiedWithinYears("", 3)).toBe(false);
		expect(isVerifiedWithinYears("not-a-date", 3)).toBe(false);
	});
});

describe("filterPlacesByRecency", () => {
	const place = (id: number, verified_at?: string): Place =>
		({ id, verified_at }) as unknown as Place;

	const list = [
		place(1, daysAgo(100)), // within 1 year
		place(2, daysAgo(500)), // within 2 years, outside 1
		place(3, daysAgo(900)), // within 3 years, outside 2
		place(4, daysAgo(2000)), // outside 3 years
		place(5, undefined), // never verified
	];

	it("returns the list unchanged when years is null", () => {
		expect(filterPlacesByRecency(list, null)).toBe(list);
	});

	it("keeps only places verified within the window", () => {
		expect(filterPlacesByRecency(list, 1).map((p) => p.id)).toEqual([1]);
		expect(filterPlacesByRecency(list, 2).map((p) => p.id)).toEqual([1, 2]);
		expect(filterPlacesByRecency(list, 3).map((p) => p.id)).toEqual([1, 2, 3]);
	});

	it("excludes places without a verified_at when a filter is active", () => {
		expect(filterPlacesByRecency(list, 3).some((p) => p.id === 5)).toBe(false);
	});
});
