import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getOpenStatus } from "./openingHoursStatus";

describe("getOpenStatus", () => {
	it("returns null for undefined input", () => {
		expect(getOpenStatus(undefined)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(getOpenStatus("")).toBeNull();
	});

	it("returns open for 24/7", () => {
		const result = getOpenStatus("24/7");
		expect(result).not.toBeNull();
		expect(result!.isOpen).toBe(true);
		expect(result!.nextChange).toBeNull();
	});

	it("returns null for unparseable hours", () => {
		expect(getOpenStatus("garbage text")).toBeNull();
	});

	it("accepts merchant coordinates for timezone-aware evaluation", () => {
		const result = getOpenStatus("24/7", { lat: 50.08, lon: 14.42 });
		expect(result).not.toBeNull();
		expect(result!.isOpen).toBe(true);
	});

	it("works without coordinates (fallback to local timezone)", () => {
		const result = getOpenStatus("24/7");
		expect(result).not.toBeNull();
		expect(result!.isOpen).toBe(true);
	});

	describe("with frozen time", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("returns open with a nextChange Date on a weekday during business hours", () => {
			// Wednesday 2026-03-18 10:00 local time
			vi.setSystemTime(new Date(2026, 2, 18, 10, 0, 0));

			const result = getOpenStatus("Mo-Fr 09:00-17:00");
			expect(result).not.toBeNull();
			expect(result!.isOpen).toBe(true);
			expect(result!.nextChange).toBeInstanceOf(Date);
		});

		it("returns closed on a Saturday for weekday-only hours", () => {
			// Saturday 2026-03-21 10:00 local time
			vi.setSystemTime(new Date(2026, 2, 21, 10, 0, 0));

			const result = getOpenStatus("Mo-Fr 09:00-17:00");
			expect(result).not.toBeNull();
			expect(result!.isOpen).toBe(false);
			expect(result!.nextChange).toBeInstanceOf(Date);
		});

		it("returns closed before opening time", () => {
			// Wednesday 2026-03-18 06:00 local time
			vi.setSystemTime(new Date(2026, 2, 18, 6, 0, 0));

			const result = getOpenStatus("Mo-Fr 09:00-17:00");
			expect(result).not.toBeNull();
			expect(result!.isOpen).toBe(false);
		});
	});
});
