import { decode } from "nostr-tools/nip19";
import type { EventTemplate, VerifiedEvent } from "nostr-tools/pure";
import { finalizeEvent } from "nostr-tools/pure";

// URL the API verifies in the NIP-98 event's "u" tag. Must match what the
// server sees, including scheme and no trailing slash.
export const NOSTR_AUTH_URL = "https://api.btcmap.org/v4/auth/nostr";

// NIP-07 extension interface (window.nostr) — minimal subset we use.
// Extensions like Alby, nos2x inject this on page load.
type NostrExtension = {
	getPublicKey: () => Promise<string>;
	signEvent: (event: EventTemplate) => Promise<VerifiedEvent>;
};

declare global {
	interface Window {
		nostr?: NostrExtension;
	}
}

// Detect a NIP-07-compatible browser extension. Returns null on SSR.
export function getNostrExtension(): NostrExtension | null {
	if (typeof window === "undefined") return null;
	return window.nostr ?? null;
}

// Build the unsigned NIP-98 event template for POST /v4/auth/nostr.
// kind 27235, with "u" (url) and "method" tags per the spec.
function buildAuthTemplate(): EventTemplate {
	return {
		kind: 27235,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["u", NOSTR_AUTH_URL],
			["method", "POST"],
		],
		content: "",
	};
}

// Sign via a NIP-07 browser extension. Throws if no extension is present or
// the user rejects the signature request.
export async function signAuthWithExtension(): Promise<VerifiedEvent> {
	const ext = getNostrExtension();
	if (!ext) throw new Error("No Nostr extension detected");
	return ext.signEvent(buildAuthTemplate());
}

// Sign locally with a raw secret key (hex or nsec-decoded Uint8Array). The
// key is used once and discarded — never stored.
export function signAuthWithSecretKey(secretKey: Uint8Array): VerifiedEvent {
	return finalizeEvent(buildAuthTemplate(), secretKey);
}

// Decode a bech32 nsec... string into its 32-byte secret key. Throws on any
// non-nsec input (npub, invalid bech32, wrong length) — callers surface a
// generic "invalid key" message rather than leaking details.
export function decodeNsec(nsec: string): Uint8Array {
	const trimmed = nsec.trim();
	const decoded = decode(trimmed);
	if (decoded.type !== "nsec") {
		throw new Error("Not an nsec");
	}
	return decoded.data;
}
