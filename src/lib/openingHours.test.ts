import { describe, expect, it } from "vitest";

import type { DayState } from "./openingHours";
import {
	generateOpeningHours,
	makeDefaultDays,
	parseOpeningHours,
} from "./openingHours";

const openDay = (
	ranges: { from: string; to: string }[],
	is24 = false,
): DayState => ({ open: true, is24, ranges });

describe("generateOpeningHours", () => {
	it("returns 24/7 regardless of day state when always-open is set", () => {
		expect(generateOpeningHours(true, makeDefaultDays())).toBe("24/7");
	});

	it("merges consecutive days sharing the same hours into a run", () => {
		const days = makeDefaultDays();
		for (const i of [0, 1, 2, 3, 4])
			days[i] = openDay([{ from: "09:00", to: "17:00" }]);
		days[5] = openDay([{ from: "10:00", to: "14:00" }]);
		expect(generateOpeningHours(false, days)).toBe(
			"Mo-Fr 09:00-17:00; Sa 10:00-14:00",
		);
	});

	it("keeps non-consecutive days separate and joins split ranges", () => {
		const days = makeDefaultDays();
		days[0] = openDay([
			{ from: "09:00", to: "12:00" },
			{ from: "13:00", to: "17:00" },
		]);
		days[2] = openDay([{ from: "09:00", to: "12:00" }]);
		expect(generateOpeningHours(false, days)).toBe(
			"Mo 09:00-12:00,13:00-17:00; We 09:00-12:00",
		);
	});

	it("writes all-day days as 00:00-24:00 and skips empty ranges", () => {
		const days = makeDefaultDays();
		days[6] = openDay([], true);
		days[0] = openDay([{ from: "", to: "17:00" }]);
		expect(generateOpeningHours(false, days)).toBe("Su 00:00-24:00");
	});

	it("returns an empty string when nothing is open", () => {
		expect(generateOpeningHours(false, makeDefaultDays())).toBe("");
	});
});

describe("parseOpeningHours", () => {
	it("round-trips what generate produces", () => {
		const value = "Mo-Fr 09:00-12:00,13:00-17:00; Sa 10:00-14:00";
		const parsed = parseOpeningHours(value);
		expect(parsed).not.toBeNull();
		expect(parsed).not.toBe("24/7");
		expect(generateOpeningHours(false, parsed as DayState[])).toBe(value);
	});

	it("recognises 24/7 as the always-open sentinel", () => {
		expect(parseOpeningHours("24/7")).toBe("24/7");
	});

	it("maps an empty string to the default all-closed grid", () => {
		const parsed = parseOpeningHours("");
		expect(parsed).not.toBeNull();
		expect((parsed as DayState[]).every((d) => !d.open)).toBe(true);
	});

	it("marks a 00:00-24:00 range as all-day", () => {
		const parsed = parseOpeningHours("Su 00:00-24:00") as DayState[];
		expect(parsed[6].open).toBe(true);
		expect(parsed[6].is24).toBe(true);
	});

	it("expands day lists with commas", () => {
		const parsed = parseOpeningHours("Mo,We 09:00-17:00") as DayState[];
		expect(parsed[0].open).toBe(true);
		expect(parsed[1].open).toBe(false);
		expect(parsed[2].open).toBe(true);
	});

	it("returns null for syntax the editor cannot represent", () => {
		// Valid opening_hours, but beyond the simple weekday+ranges subset.
		expect(parseOpeningHours("Mo-Fr 09:00-17:00; PH off")).toBeNull();
		expect(parseOpeningHours("sunrise-sunset")).toBeNull();
		expect(parseOpeningHours("Fr-Mo 09:00-17:00")).toBeNull();
	});
});
