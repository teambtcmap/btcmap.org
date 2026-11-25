import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getOpenStatus } from "./openingHoursStatus";

describe("getOpenStatus", () => {
	it("returns null for undefined input", () => {
		expect(getOpenStatus(undefined)).toBeNull();
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

	describe("with frozen time", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
			vi.unstubAllEnvs();
		});

		it("uses the merchant's coordinates for sunrise and sunset", () => {
			// Reykjavik (UTC+0) in mid-December: the sun rises around 11:16.
			// Without the coordinates the library assumes 06:00-18:00 and says open.
			vi.stubEnv("TZ", "UTC");
			vi.setSystemTime(new Date("2026-12-15T10:00:00Z"));

			const result = getOpenStatus("sunrise-sunset", {
				lat: 64.15,
				lon: -21.94,
			});
			expect(result).not.toBeNull();
			expect(result!.isOpen).toBe(false);
			expect(result!.nextChange?.getUTCHours()).toBe(11);
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
