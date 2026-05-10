import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";

// A signed NIP-98 event is ~400 bytes. 4 KB leaves generous headroom for
// unusual tag sets while rejecting obvious junk bodies before we try to parse.
const MAX_BODY_BYTES = 4096;

// Cap the upstream call so a slow/unresponsive btcmap-api can't pin a
// SvelteKit request handler indefinitely (and leave the user staring at
// a "Signing…" spinner). 10s is generous: the API path here is a sync
// DB lookup + token mint, no network.
const UPSTREAM_TIMEOUT_MS = 10_000;

// POST /api/session/nostr
//
// Browser sends a signed NIP-98 event (kind 27235) as JSON: {signed_event}.
// We base64-encode it server-side and forward to btcmap-api as the canonical
// "Authorization: Nostr <base64>" header (no body), per NIP-98. Going through
// this server route avoids a browser CORS preflight on the cross-origin POST.
//
// On success the API auto-creates a fresh user when the npub is unknown,
// otherwise mints a Bearer token bound to the existing user.
export const POST: RequestHandler = async ({ request, fetch }) => {
	// Require content-length and that it's within the cap. A missing header
	// (e.g. chunked transfer encoding) would otherwise let Number(null) ⇒ 0
	// satisfy the upper-bound check and bypass the guard, so we reject it
	// outright and let SvelteKit's own body-limit catch the fallback case.
	const contentLengthHeader = request.headers.get("content-length");
	if (!contentLengthHeader) {
		error(411, "Content-Length header required");
	}
	const contentLength = Number(contentLengthHeader);
	if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
		error(413, "Request body too large");
	}

	let body: { signed_event?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, "Invalid JSON body");
	}

	const signedEvent = body.signed_event;
	if (!signedEvent || typeof signedEvent !== "object") {
		error(400, "Missing or invalid signed_event");
	}

	const eventB64 = Buffer.from(JSON.stringify(signedEvent), "utf-8").toString(
		"base64",
	);

	let res: Response;
	try {
		res = await fetch(`${API_BASE}/v4/auth/nostr`, {
			method: "POST",
			headers: { Authorization: `Nostr ${eventB64}` },
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (err) {
		// AbortError (timeout) and any other fetch failure both surface as
		// 502 Bad Gateway — the upstream is the failure source either way.
		console.error("Failed to exchange Nostr event:", err);
		error(502, "Failed to authenticate with Nostr");
	}

	if (!res.ok) {
		if (res.status === 401 || res.status === 403) {
			error(401, "Invalid Nostr signature");
		}
		console.error("Nostr exchange returned non-2xx:", res.status);
		error(502, "Failed to authenticate with Nostr");
	}

	let data: { token?: unknown; username?: unknown; npub?: unknown };
	try {
		data = (await res.json()) as typeof data;
	} catch (err) {
		console.error("Failed to parse Nostr exchange response:", err);
		error(502, "Nostr auth returned invalid response");
	}

	const { token, username, npub } = data;
	if (
		typeof token !== "string" ||
		typeof username !== "string" ||
		typeof npub !== "string"
	) {
		error(502, "Nostr auth returned invalid response");
	}

	return json({ token, username, npub });
};
