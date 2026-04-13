import { error, json } from "@sveltejs/kit";

import api from "$lib/axios";
import { NOSTR_AUTH_URL } from "$lib/nostr";

import type { RequestHandler } from "./$types";

// A signed NIP-98 event is ~400 bytes. 4 KB leaves generous headroom for
// unusual tag sets while rejecting obvious junk bodies before we try to parse.
const MAX_BODY_BYTES = 4096;

// POST /api/session/nostr
// Exchanges a signed NIP-98 event (kind 27235) for a BTC Map Bearer token.
// Proxies POST /v4/auth/nostr to avoid browser CORS preflight issues.
// If the npub is unknown, the API creates a new account linked to that pubkey.
export const POST: RequestHandler = async ({ request }) => {
	const contentLength = Number(request.headers.get("content-length"));
	if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
		error(413, "Request body too large");
	}

	const body = await request.json();
	const { signed_event } = body;

	if (!signed_event || typeof signed_event !== "object") {
		error(400, "Missing or invalid signed_event");
	}

	const res = await api.post(NOSTR_AUTH_URL, { signed_event }).catch((err) => {
		const status = err?.response?.status;
		if (status === 401 || status === 403) {
			error(401, "Invalid Nostr signature");
		}
		console.error("Failed to exchange Nostr event:", status);
		error(502, "Failed to authenticate with Nostr");
	});

	const token = res.data?.token;
	const username = res.data?.username;
	if (typeof token !== "string" || typeof username !== "string") {
		error(502, "Nostr auth returned invalid response");
	}

	return json({ token, username });
};
