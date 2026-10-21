import { decode } from "nostr-tools/nip19";
import type { Event, EventTemplate } from "nostr-tools/pure";
import { finalizeEvent } from "nostr-tools/pure";

import { API_BASE } from "#lib/api-base.js";

// URL the API verifies in the NIP-98 event's "u" tag. Must match what the
// btcmap-api server reconstructs (its BTCMAP_API_BASE_URL + request path),
// including scheme and no trailing slash. Driven by API_BASE so the signed
// `u` and the client's own POST always resolve to the same absolute URL —
// never split these two apart, or the signature binds to a different URL
// than the request actually hits.
//
// API_BASE must be ABSOLUTE for the Nostr flow. In prod it defaults to
// https://api.btcmap.org; for local API dev set VITE_API_BASE_URL to the
// absolute http://127.0.0.1:8000. The relative Vite dev-proxy form
// (VITE_API_BASE_URL=/btcmap-api-proxy) is NOT supported here: it would sign a
// relative `u` that can't match the server's absolute reconstruction (→ 401).
export const NOSTR_AUTH_URL = `${API_BASE}/v4/auth/nostr`;

// Linking a key to the signed-in account (PUT): same NIP-98 rules, its own
// URL and method in the signed event.
export const NOSTR_LINK_URL = `${API_BASE}/v4/users/me/nostr`;

// Both signing paths return something the server can verify. The local
// path (finalizeEvent) yields nostr-tools' branded VerifiedEvent; NIP-07
// extensions only return a plain signed Event (no verifiedSymbol). Our
// callers JSON-serialize and let btcmap-api re-verify the Schnorr sig,
// so the brand is irrelevant — typing both paths as plain Event avoids
// misleading any future code that might inspect the brand.
export type SignedAuthEvent = Event;

// NIP-98 requests carry the signed event base64-encoded in the
// Authorization header, body-less. btoa needs a byte string, hence the
// TextEncoder round-trip for any non-Latin-1 characters in the event.
export function encodeNip98Event(event: SignedAuthEvent): string {
	return btoa(
		String.fromCharCode(...new TextEncoder().encode(JSON.stringify(event))),
	);
}

// NIP-07 extension interface (window.nostr) — minimal subset we use.
// Extensions inject this on page load.
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

// The HTTP methods our NIP-98 requests use.
export type Nip98Method = "POST" | "PUT";

// Build the unsigned NIP-98 event template for a request: kind 27235, with
// "u" (url) and "method" tags per the spec. Exported factories are what the
// signer transports hand to the relay, so they build the template at signing
// time rather than at connect time (the API's +/-60s window).
export function buildNip98Template(
	url: string,
	method: Nip98Method,
): EventTemplate {
	return {
		kind: 27235,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["u", url],
			["method", method],
		],
		content: "",
	};
}

// The login request, POST /v4/auth/nostr, as a template. Kept as its own
// factory because the signer transports build it at signing time.
export const buildAuthTemplate = (): EventTemplate =>
	buildNip98Template(NOSTR_AUTH_URL, "POST");

// Sign via a NIP-07 browser extension. Throws if no extension is present or
// the user rejects the signature request. Returns a plain signed Event —
// extensions don't set the nostr-tools "verified" brand.
export async function signTemplateWithExtension(
	template: EventTemplate,
): Promise<SignedAuthEvent> {
	const ext = getNostrExtension();
	if (!ext) throw new Error("No Nostr extension detected");
	return ext.signEvent(template);
}

// Sign locally with a raw secret key (typically the bytes returned by
// decodeNsec). The key is used once; callers should zero their copy
// (best-effort) after use. The underlying finalizeEvent returns a branded
// VerifiedEvent which is assignable to Event — we widen to SignedAuthEvent
// so both signing paths share one type at the call site.
export function signTemplateWithSecretKey(
	template: EventTemplate,
	secretKey: Uint8Array,
): SignedAuthEvent {
	return finalizeEvent(template, secretKey);
}

// The NIP-98 helpers bound to a URL and method. Login signs POST
// /v4/auth/nostr; linking a key signs PUT /v4/users/me/nostr.
export const signNip98WithExtension = (
	url: string,
	method: Nip98Method,
): Promise<SignedAuthEvent> =>
	signTemplateWithExtension(buildNip98Template(url, method));

export const signNip98WithSecretKey = (
	secretKey: Uint8Array,
	url: string,
	method: Nip98Method,
): SignedAuthEvent =>
	signTemplateWithSecretKey(buildNip98Template(url, method), secretKey);

// The login request, POST /v4/auth/nostr.
export const signAuthWithExtension = (): Promise<SignedAuthEvent> =>
	signNip98WithExtension(NOSTR_AUTH_URL, "POST");

export const signAuthWithSecretKey = (secretKey: Uint8Array): SignedAuthEvent =>
	signNip98WithSecretKey(secretKey, NOSTR_AUTH_URL, "POST");

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

// Shape returned by POST /v4/auth/nostr on a successful login.
export type NostrAuthResult = {
	token: string;
	username: string;
	npub: string | null;
};

// Validate and narrow the API's auth response. Throws when token or username
// is missing (the API returns both on success, but the client re-checks
// defensively); npub is narrowed to string | null (absent/non-string → null).
export function parseNostrAuthResponse(data: unknown): NostrAuthResult {
	const d = (data ?? {}) as {
		token?: unknown;
		username?: unknown;
		npub?: unknown;
	};
	if (typeof d.token !== "string" || typeof d.username !== "string") {
		throw new Error("Nostr auth did not return a token");
	}
	return {
		token: d.token,
		username: d.username,
		npub: typeof d.npub === "string" ? d.npub : null,
	};
}
