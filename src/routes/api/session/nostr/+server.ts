import { error, json } from "@sveltejs/kit";

import api from "$lib/axios";

import type { RequestHandler } from "./$types";

// POST /api/session/nostr
// Exchanges a signed NIP-98 event (kind 27235) for a BTC Map Bearer token.
// Proxies POST /v4/auth/nostr to avoid browser CORS preflight issues.
// If the npub is unknown, the API creates a new account linked to that pubkey.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { signed_event } = body;

	if (!signed_event || typeof signed_event !== "object") {
		error(400, "Missing or invalid signed_event");
	}

	const res = await api
		.post("https://api.btcmap.org/v4/auth/nostr", { signed_event })
		.catch((err) => {
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
