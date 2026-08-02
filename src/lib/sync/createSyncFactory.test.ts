import { describe, expect, it } from "vitest";

import { isSyncableRow } from "./createSyncFactory";

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
