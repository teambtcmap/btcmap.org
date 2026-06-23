import { decode } from "nostr-tools/nip19";
import type { Event, EventTemplate } from "nostr-tools/pure";
import { finalizeEvent } from "nostr-tools/pure";

import { API_BASE } from "$lib/api-base";

// URL the API verifies in the NIP-98 event's "u" tag. Must match what the
// btcmap-api server reconstructs (its BTCMAP_API_BASE_URL + request path),
// including scheme and no trailing slash. Driven by API_BASE so the signed
// `u` and the server route's upstream fetch (routes/api/session/nostr) always
// resolve to the same absolute URL — never split these two apart, or the
// signature binds to a different URL than the request actually hits.
//
// API_BASE must be ABSOLUTE for the Nostr flow. In prod it defaults to
// https://api.btcmap.org; for local API dev set VITE_API_BASE_URL to the
// absolute http://127.0.0.1:8000. The relative Vite dev-proxy form
// (VITE_API_BASE_URL=/btcmap-api-proxy) is NOT supported here: it would sign a
// relative `u` that can't match the server's absolute reconstruction (→ 401),
// and the server-side proxy fetch needs an absolute URL anyway.
export const NOSTR_AUTH_URL = `${API_BASE}/v4/auth/nostr`;

// Both signing paths return something the server can verify. The local
// path (finalizeEvent) yields nostr-tools' branded VerifiedEvent; NIP-07
// extensions only return a plain signed Event (no verifiedSymbol). Our
// callers JSON-serialize and let btcmap-api re-verify the Schnorr sig,
// so the brand is irrelevant — typing both paths as plain Event avoids
// misleading any future code that might inspect the brand.
export type SignedAuthEvent = Event;

// NIP-07 extension interface (window.nostr) — minimal subset we use.
// Extensions like Alby, nos2x inject this on page load.
type NostrExtension = {
	getPublicKey: () => Promise<string>;
	signEvent: (event: EventTemplate) => Promise<Event>;
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
// the user rejects the signature request. Returns a plain signed Event —
// extensions don't set the nostr-tools "verified" brand.
export async function signAuthWithExtension(): Promise<SignedAuthEvent> {
	const ext = getNostrExtension();
	if (!ext) throw new Error("No Nostr extension detected");
	return ext.signEvent(buildAuthTemplate());
}

// Sign locally with a raw secret key (typically the bytes returned by
// decodeNsec). The key is used once; callers should zero their copy
// (best-effort) after use. The underlying finalizeEvent returns a branded
// VerifiedEvent which is assignable to Event — we widen to SignedAuthEvent
// so both signing paths share one type at the call site.
export function signAuthWithSecretKey(secretKey: Uint8Array): SignedAuthEvent {
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
