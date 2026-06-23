import { nip19 } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import { decodeNsec, signAuthWithSecretKey } from "./nostr";

describe("decodeNsec", () => {
	it("returns 32 bytes for a valid nsec", () => {
		const sk = generateSecretKey();
		const nsec = nip19.nsecEncode(sk);
		const decoded = decodeNsec(nsec);
		expect(decoded).toBeInstanceOf(Uint8Array);
		expect(decoded).toHaveLength(32);
		// Round-trip: decoding the encoding of a key returns that key
		expect(Array.from(decoded)).toEqual(Array.from(sk));
	});

	it("trims surrounding whitespace before decoding", () => {
		const sk = generateSecretKey();
		const nsec = nip19.nsecEncode(sk);
		expect(decodeNsec(`  ${nsec}\n`)).toHaveLength(32);
	});

	it("rejects an npub", () => {
		const npub = nip19.npubEncode(getPublicKey(generateSecretKey()));
		expect(() => decodeNsec(npub)).toThrowError(/not an nsec/i);
	});

	it("rejects malformed bech32", () => {
		expect(() => decodeNsec("nsec1notvalidbech32")).toThrow();
	});

	it("rejects empty input", () => {
		expect(() => decodeNsec("")).toThrow();
	});
});

describe("signAuthWithSecretKey", () => {
	it("produces a signed kind 27235 event with the expected NIP-98 tags", () => {
		const sk = generateSecretKey();
		const event = signAuthWithSecretKey(sk);

		expect(event.kind).toBe(27235);
		expect(event.content).toBe("");
		expect(event.id).toMatch(/^[0-9a-f]{64}$/);
		expect(event.sig).toMatch(/^[0-9a-f]{128}$/);
		expect(event.pubkey).toBe(getPublicKey(sk));

		const tagNames = event.tags.map((t) => t[0]);
		expect(tagNames).toContain("u");
		expect(tagNames).toContain("method");

		const methodTag = event.tags.find((t) => t[0] === "method");
		expect(methodTag?.[1]).toBe("POST");

		const uTag = event.tags.find((t) => t[0] === "u");
		// URL is driven by API_BASE which defaults to https://api.btcmap.org
		// in tests (no VITE_API_BASE_URL set).
		expect(uTag?.[1]).toMatch(/\/v4\/auth\/nostr$/);
	});

	it("uses created_at near the current time", () => {
		const before = Math.floor(Date.now() / 1000);
		const event = signAuthWithSecretKey(generateSecretKey());
		const after = Math.floor(Date.now() / 1000);
		expect(event.created_at).toBeGreaterThanOrEqual(before);
		expect(event.created_at).toBeLessThanOrEqual(after);
	});

	it("produces distinct events for the same key (different created_at / id)", () => {
		// Advance the wall clock deterministically with fake timers instead of
		// a real 1.1s sleep — created_at is unix seconds, so it must tick over.
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
			const sk = generateSecretKey();
			const a = signAuthWithSecretKey(sk);
			vi.advanceTimersByTime(1100);
			const b = signAuthWithSecretKey(sk);
			expect(b.created_at).toBeGreaterThan(a.created_at);
			expect(b.id).not.toBe(a.id);
		} finally {
			vi.useRealTimers();
		}
	});
});
