import { describe, expect, it } from "vitest";

import {
	isSyncableRow,
	nextCursor,
	validateSyncPage,
} from "./createSyncFactory";

describe("isSyncableRow", () => {
	it("accepts a well-formed entity row", () => {
		expect(
			isSyncableRow({ id: "de", updated_at: "2026-01-01T00:00:00Z" }),
		).toBe(true);
		expect(isSyncableRow({ id: 42, updated_at: "2026-01-01T00:00:00Z" })).toBe(
			true,
		);
	});

	// The corruption observed in the field: a non-JSON API response parsed as
	// a string gets character-iterated by the crawl loops, and the dedup
	// collapse leaves one stray character (a trailing newline) that then
	// survives every incremental merge in the persisted cache.
	it("rejects stray string fragments", () => {
		expect(isSyncableRow("\n")).toBe(false);
		expect(isSyncableRow("")).toBe(false);
		expect(isSyncableRow("<html>")).toBe(false);
	});

	it("rejects null, undefined, and primitives", () => {
		expect(isSyncableRow(null)).toBe(false);
		expect(isSyncableRow(undefined)).toBe(false);
		expect(isSyncableRow(0)).toBe(false);
		expect(isSyncableRow(true)).toBe(false);
	});

	it("rejects objects without a usable id", () => {
		expect(isSyncableRow({})).toBe(false);
		expect(isSyncableRow({ id: null, updated_at: "2026-01-01" })).toBe(false);
		expect(isSyncableRow({ id: undefined, updated_at: "2026-01-01" })).toBe(
			false,
		);
		// The merge maps key on id — only string/number keys dedupe correctly.
		expect(isSyncableRow({ id: {}, updated_at: "2026-01-01" })).toBe(false);
		expect(isSyncableRow({ id: [], updated_at: "2026-01-01" })).toBe(false);
	});

	it("rejects rows whose updated_at cannot drive the sync cursor", () => {
		expect(isSyncableRow({ id: 1 })).toBe(false);
		expect(isSyncableRow({ id: 1, updated_at: null })).toBe(false);
		expect(isSyncableRow({ id: 1, updated_at: 12345 })).toBe(false);
		// A string that isn't a date would poison the updated_since cursor.
		expect(isSyncableRow({ id: 1, updated_at: "not-a-date" })).toBe(false);
		expect(isSyncableRow({ id: 1, updated_at: "" })).toBe(false);
	});
});

describe("validateSyncPage", () => {
	const valid = (id: number) => ({
		id,
		updated_at: "2026-01-01T00:00:00Z",
	});

	it("passes a valid page through with its raw count", () => {
		const page = [valid(1), valid(2)];
		expect(validateSyncPage(page)).toEqual({ rows: page, rawCount: 2 });
	});

	it("treats an empty page as the normal end of data", () => {
		expect(validateSyncPage([])).toEqual({ rows: [], rawCount: 0 });
	});

	it("throws on a non-JSON (string) response instead of iterating it", () => {
		expect(() => validateSyncPage("<html>maintenance</html>\n")).toThrow(
			"invalid data format",
		);
		expect(() => validateSyncPage(undefined)).toThrow("invalid data format");
	});

	it("throws on a non-empty page with zero valid rows", () => {
		expect(() => validateSyncPage(["\n", null, {}])).toThrow("no valid rows");
	});

	it("drops invalid rows but keeps the raw count for pagination", () => {
		const page = [valid(1), "\n", valid(2)];
		const result = validateSyncPage(page);
		expect(result.rows).toEqual([valid(1), valid(2)]);
		expect(result.rawCount).toBe(3);
	});
});

describe("nextCursor", () => {
	it("advances to the page's last timestamp when it moved", () => {
		expect(
			nextCursor("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"),
		).toBe("2026-01-02T00:00:00.000Z");
	});

	// The v2 updated_since is inclusive (the crawl dedup exists because each
	// page's last row reappears on the next). A FULL page sharing one
	// timestamp can therefore never advance the cursor — the crawl would
	// refetch the same page forever. Nudging one millisecond past the stuck
	// timestamp trades bounded staleness (skipped rows return whenever they
	// next update) for guaranteed progress.
	it("nudges one millisecond past a stuck timestamp", () => {
		expect(
			nextCursor("2025-07-07T08:08:14.974Z", "2025-07-07T08:08:14.974Z"),
		).toBe("2025-07-07T08:08:14.975Z");
	});

	it("rolls the nudge across a second boundary", () => {
		expect(
			nextCursor("2025-07-07T08:08:14.999Z", "2025-07-07T08:08:14.999Z"),
		).toBe("2025-07-07T08:08:15.000Z");
	});
});
