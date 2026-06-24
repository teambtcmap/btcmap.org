import { afterEach, describe, expect, it, vi } from "vitest";

// Stub SimplePool so no real relay sockets are opened; mockGet stands in for
// pool.get and is controlled per test.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("nostr-tools/pool", () => ({
	SimplePool: vi.fn(() => ({ get: mockGet })),
}));

import { fetchProfile } from "./nostrProfile";

// 64-char hex pubkey — fetchProfile accepts hex directly, so tests skip npub
// decoding. A distinct fill char per test avoids the module-level cache
// colliding across cases.
const hex = (fill: string) => fill.repeat(64);

const metadataEvent = (content: string) => ({
	kind: 0,
	content,
	pubkey: "00",
	id: "00",
	sig: "00",
	created_at: 0,
	tags: [],
});

afterEach(() => mockGet.mockReset());

describe("fetchProfile", () => {
	it("parses a full kind:0 profile", async () => {
		mockGet.mockResolvedValue(
			metadataEvent(
				JSON.stringify({
					name: "alice",
					display_name: "Alice",
					picture: "https://example.test/a.png",
					nip05: "alice@example.test",
				}),
			),
		);
		expect(await fetchProfile(hex("a"))).toEqual({
			name: "alice",
			displayName: "Alice",
			picture: "https://example.test/a.png",
			nip05: "alice@example.test",
		});
	});

	it("keeps only the fields that are present", async () => {
		mockGet.mockResolvedValue(metadataEvent(JSON.stringify({ name: "bob" })));
		expect(await fetchProfile(hex("b"))).toEqual({ name: "bob" });
	});

	it("ignores non-string fields", async () => {
		mockGet.mockResolvedValue(
			metadataEvent(JSON.stringify({ name: 42, picture: null })),
		);
		expect(await fetchProfile(hex("9"))).toEqual({});
	});

	it("returns null on malformed JSON content", async () => {
		mockGet.mockResolvedValue(metadataEvent("{ not json"));
		expect(await fetchProfile(hex("c"))).toBeNull();
	});

	it("returns null when no event is found (miss/timeout)", async () => {
		mockGet.mockResolvedValue(null);
		expect(await fetchProfile(hex("d"))).toBeNull();
	});

	it("returns null when the relay query throws", async () => {
		mockGet.mockRejectedValue(new Error("relay down"));
		expect(await fetchProfile(hex("e"))).toBeNull();
	});

	it("returns null and does not query for invalid input", async () => {
		expect(await fetchProfile("not-an-npub")).toBeNull();
		expect(mockGet).not.toHaveBeenCalled();
	});

	it("caches a hit — a second call returns the same object without re-querying", async () => {
		mockGet.mockResolvedValue(metadataEvent(JSON.stringify({ name: "frank" })));
		const first = await fetchProfile(hex("f"));
		const second = await fetchProfile(hex("f"));
		expect(second).toBe(first);
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	it("caches negatives — a null result is not refetched", async () => {
		mockGet.mockResolvedValue(null);
		await fetchProfile(hex("8"));
		await fetchProfile(hex("8"));
		expect(mockGet).toHaveBeenCalledTimes(1);
	});
});
