import { describe, expect, it } from "vitest";

import type { AreaEvent } from "#lib/types.js";

import {
	countFutureEvents,
	isEpochSentinel,
	isFutureEvent,
	parseLocalDateTime,
} from "./events";

const event = (starts_at: string, ends_at?: string): AreaEvent => ({
	id: 1,
	lat: 0,
	lon: 0,
	name: "Meetup",
	website: "https://example.com",
	status: "live",
	starts_at,
	ends_at,
});

// Local wall-clock "now", matching how event strings are interpreted
const now = new Date(2026, 9, 1, 12, 0).getTime();

describe("parseLocalDateTime", () => {
	it("reads the wall-clock components and ignores the timezone suffix", () => {
		expect(parseLocalDateTime("2026-10-01T19:30:00+07:00")).toEqual({
			year: 2026,
			month: 10,
			day: 1,
			hour: 19,
			minute: 30,
		});
	});

	it("returns null for unparseable input", () => {
		expect(parseLocalDateTime("tomorrow")).toBeNull();
	});
});

describe("isEpochSentinel", () => {
	it("flags the API's 1970-01-01T00:00 no-date value", () => {
		const parts = parseLocalDateTime("1970-01-01T00:00:00Z");
		expect(parts && isEpochSentinel(parts)).toBe(true);
	});

	it("does not flag a real date", () => {
		const parts = parseLocalDateTime("1970-01-01T00:01:00Z");
		expect(parts && isEpochSentinel(parts)).toBe(false);
	});
});

describe("isFutureEvent", () => {
	it("counts an event that has not started yet", () => {
		expect(isFutureEvent(event("2026-10-02T18:00:00Z"), now)).toBe(true);
	});

	it("treats an event that started and ended earlier as past", () => {
		expect(
			isFutureEvent(event("2026-09-30T18:00:00Z", "2026-09-30T21:00:00Z"), now),
		).toBe(false);
	});

	it("counts an event that is running right now", () => {
		expect(
			isFutureEvent(event("2026-09-30T09:00:00Z", "2026-10-03T18:00:00Z"), now),
		).toBe(true);
	});

	it("falls back to starts_at when ends_at is the epoch sentinel", () => {
		expect(
			isFutureEvent(event("2026-09-30T18:00:00Z", "1970-01-01T00:00:00Z"), now),
		).toBe(false);
	});

	it("keeps undated and unparseable events visible as open-ended", () => {
		expect(isFutureEvent(event("1970-01-01T00:00:00Z"), now)).toBe(true);
		expect(isFutureEvent(event("garbage"), now)).toBe(true);
	});
});

describe("countFutureEvents", () => {
	it("counts ongoing events alongside upcoming ones", () => {
		const events = [
			event("2026-09-30T09:00:00Z", "2026-10-03T18:00:00Z"),
			event("2026-10-05T18:00:00Z"),
			event("2026-09-01T18:00:00Z"),
		];
		expect(countFutureEvents(events, now)).toBe(2);
	});

	it("returns 0 for no events", () => {
		expect(countFutureEvents([], now)).toBe(0);
	});
});
