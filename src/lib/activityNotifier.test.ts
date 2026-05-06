import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/axios", () => ({
	default: { get: vi.fn() },
}));

async function freshModule() {
	vi.resetModules();
	return await import("$lib/activityNotifier");
}

describe("activityNotifier — pure helpers and stores", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("storageKeyFor returns a per-username key", async () => {
		const m = await freshModule();
		expect(m.storageKeyFor("alice")).toBe("btcmap_activity_lastseen:alice");
	});

	it("hasNewActivity is false when latest is null", async () => {
		const m = await freshModule();
		expect(get(m.hasNewActivity)).toBe(false);
	});

	it("hasNewActivity is true when latest > lastSeen", async () => {
		const m = await freshModule();
		m.latestActivityDate.set("2026-05-06T10:00:00Z");
		m.lastSeenActivityDate.set("2026-05-06T09:00:00Z");
		expect(get(m.hasNewActivity)).toBe(true);
	});

	it("hasNewActivity is false when latest equals lastSeen", async () => {
		const m = await freshModule();
		m.latestActivityDate.set("2026-05-06T10:00:00Z");
		m.lastSeenActivityDate.set("2026-05-06T10:00:00Z");
		expect(get(m.hasNewActivity)).toBe(false);
	});

	it("hasNewActivity is true when lastSeen is null but latest is set", async () => {
		const m = await freshModule();
		m.latestActivityDate.set("2026-05-06T10:00:00Z");
		m.lastSeenActivityDate.set(null);
		expect(get(m.hasNewActivity)).toBe(true);
	});

	it("markActivitySeen writes the per-username key and updates the store", async () => {
		const m = await freshModule();
		m.markActivitySeen("alice", "2026-05-06T10:00:00Z");
		expect(localStorage.getItem("btcmap_activity_lastseen:alice")).toBe(
			"2026-05-06T10:00:00Z",
		);
		expect(get(m.lastSeenActivityDate)).toBe("2026-05-06T10:00:00Z");
	});

	it("loadLastSeen reads the per-username key into the store", async () => {
		localStorage.setItem(
			"btcmap_activity_lastseen:alice",
			"2026-05-06T08:00:00Z",
		);
		const m = await freshModule();
		m.loadLastSeen("alice");
		expect(get(m.lastSeenActivityDate)).toBe("2026-05-06T08:00:00Z");
	});

	it("loadLastSeen sets store to null when no key exists", async () => {
		const m = await freshModule();
		m.lastSeenActivityDate.set("stale");
		m.loadLastSeen("alice");
		expect(get(m.lastSeenActivityDate)).toBeNull();
	});
});
