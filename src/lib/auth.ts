import { get } from "svelte/store";

import { trackEvent } from "#lib/analytics.js";
import { errorStatus } from "#lib/apiError.js";
import { authedClient } from "#lib/authedApi.js";
import api from "#lib/axios.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import {
	encodeNip98Event,
	NOSTR_AUTH_URL,
	parseNostrAuthResponse,
} from "#lib/nostr.js";
import type { HydrateResult } from "#lib/savedItems.js";
import { hydrateSavedFromServer } from "#lib/savedItems.js";
import type { Session } from "#lib/session.js";
import { mintToken, session } from "#lib/session.js";

// Logging in, whichever way: the credential exchange, the session, and the
// saved items that come with it. The forms collect credentials and map
// failures to copy; the hosts decide where to go next. Sign-up stays in
// session.signUp: a fresh account has nothing saved to load.

export type Login = {
	session: Session;
	// The account's saved places and areas, loading in the background. Best
	// effort, never rejects: a failed load must not turn a login into an
	// error. Await it before reading the saved lists (e.g. /user/activity).
	savedItems: Promise<HydrateResult>;
};

const start = (
	username: Session["username"],
	token: Session["token"],
	npub: Session["npub"],
): Login => {
	session.login(username, token, npub);
	const current = get(session);
	if (!current) throw new Error("session.login did not populate the store");
	const savedItems = hydrateSavedFromServer(authedClient(token)).catch(
		(error: unknown): HydrateResult => {
			console.error("login: saved items failed to load", errorStatus(error));
			return { place: false, area: false };
		},
	);
	return { session: current, savedItems };
};

export const loginWithPassword = async (
	username: string,
	password: string,
): Promise<Login> => {
	const name = username.trim();
	// Straight against the API (it answers CORS preflights, #1348)
	const token = await mintToken(name, password);
	const login = start(name, token, null);
	trackEvent("login_password_success");
	return login;
};

// Exchanges a NIP-98 event signed for NOSTR_AUTH_URL for a session. The npub
// is kept on the session to drive the user's Nostr avatar.
export const loginWithNostrEvent = async (
	signed: SignedAuthEvent,
): Promise<Login> => {
	// NOSTR_AUTH_URL is the same constant the signed `u` tag is built from —
	// the signature binds to the URL, so they must never diverge. undefined
	// (not null) so axios sends no body and no content-type: a body would
	// require a payload-hash tag in the event.
	const res = await api.post(NOSTR_AUTH_URL, undefined, {
		headers: { Authorization: `Nostr ${encodeNip98Event(signed)}` },
	});
	const { token, username, npub } = parseNostrAuthResponse(res.data);
	return start(username, token, npub);
};

// The API's answer to wrong credentials, or to a signature it won't accept
export const isLoginRefused = (error: unknown): boolean => {
	const status = errorStatus(error);
	return status === 401 || status === 403;
};
