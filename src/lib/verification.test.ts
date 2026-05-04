import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Place } from "$lib/types";

const FIXED_NOW = new Date("2026-05-04T12:00:00Z").getTime();

const daysAgo = (days: number) =>
	new Date(FIXED_NOW - days * 24 * 60 * 60 * 1000).toISOString();

// calcVerifiedDate memoizes per calendar day at module scope, so reset
// modules before each test to get a fresh cache under the fake clock.
type VerificationModule = typeof import("./verification");
let logic: VerificationModule;

beforeEach(async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(FIXED_NOW));
	vi.resetModules();
	logic = await import("./verification");
});

afterEach(() => {
	vi.useRealTimers();
});

describe("calcVerifiedDate", () => {
	it("returns exactly one year before now", () => {
		const result = logic.calcVerifiedDate();
		const oneYearAgo = new Date(FIXED_NOW);
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		expect(result).toBe(oneYearAgo.getTime());
	});
});

describe("isRecentlyVerified", () => {
	it("returns true for a date well within the 12-month window", () => {
		expect(logic.isRecentlyVerified(daysAgo(30))).toBe(true);
		expect(logic.isRecentlyVerified(daysAgo(180))).toBe(true);
	});

	it("returns false for a date older than 12 months", () => {
		expect(logic.isRecentlyVerified(daysAgo(400))).toBe(false);
	});

	// Regression for issue #964: AreaPage previously used
	// differenceInMonths(now, date) > 12 (whole-month rounding), so a place
	// 12 months + 15 days old looked "current" there while MerchantCard's
	// ms-precision check called it outdated. Both must agree.
	it("returns false for a date 12 months and 15 days old", () => {
		const date = new Date(FIXED_NOW);
		date.setFullYear(date.getFullYear() - 1);
		date.setDate(date.getDate() - 15);
		expect(logic.isRecentlyVerified(date.toISOString())).toBe(false);
	});

	it("returns false for undefined, null, empty, or invalid input", () => {
		expect(logic.isRecentlyVerified(undefined)).toBe(false);
		expect(logic.isRecentlyVerified(null)).toBe(false);
		expect(logic.isRecentlyVerified("")).toBe(false);
		expect(logic.isRecentlyVerified("not-a-date")).toBe(false);
	});
});

describe("isUpToDate", () => {
	const place = (verified_at: string | undefined): Place =>
		({ id: 1, verified_at }) as unknown as Place;

	it("returns true when verified_at is within the window", () => {
		expect(logic.isUpToDate(place(daysAgo(30)))).toBe(true);
	});

	it("returns false when verified_at is outside the window", () => {
		expect(logic.isUpToDate(place(daysAgo(400)))).toBe(false);
	});

	it("returns false when merchant or verified_at is missing", () => {
		expect(logic.isUpToDate(null)).toBe(false);
		expect(logic.isUpToDate(place(undefined))).toBe(false);
	});
});
