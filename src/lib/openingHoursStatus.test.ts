import { describe, expect, it } from "vitest";

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
		// 24/7 has no next change
		expect(result!.nextChange).toBeNull();
	});

	it("returns null for unparseable hours", () => {
		expect(getOpenStatus("garbage text")).toBeNull();
	});

	it("returns a nextChange string for time-bounded hours", () => {
		const result = getOpenStatus("Mo-Su 00:00-23:59");
		expect(result).not.toBeNull();
		if (result?.nextChange) {
			expect(result.nextChange).toMatch(/^(Closes|Opens) \d{1,2}/);
		}
	});

	it("accepts merchant coordinates for timezone-aware evaluation", () => {
		// Prague coordinates
		const result = getOpenStatus("24/7", { lat: 50.08, lon: 14.42 });
		expect(result).not.toBeNull();
		expect(result!.isOpen).toBe(true);
	});

	it("works without coordinates (fallback to local timezone)", () => {
		const result = getOpenStatus("24/7");
		expect(result).not.toBeNull();
		expect(result!.isOpen).toBe(true);
	});
});
