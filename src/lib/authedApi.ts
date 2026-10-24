import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { isAxiosError } from "axios";
import { get } from "svelte/store";

import api from "#lib/axios.js";
import type { Session } from "#lib/session.js";
import { session } from "#lib/session.js";

// Calls to the btcmap API as the signed-in user (#1348: straight from the
// client with the Bearer token). Callers never see the token: a client is
// pinned to one session's token when it is made, so every call of a flow
// (an upload and its undo, a request and the store write after it) goes out
// as the same account, and stillCurrent() says whether that account is
// still the one signed in.
//
// A failed call rejects with the Axios error scrubbed of the credentials
// and the request body (passwords included), so logging it whole can't
// leak them. A 401/403 is not taken as "logged out": some endpoints also
// answer it for a bad Nostr signature or someone else's photo. Callers
// read the status (errorStatus in apiError.ts) and decide.

export class NotSignedInError extends Error {
	constructor() {
		super("no signed-in session");
		this.name = "NotSignedInError";
	}
}

export type AuthedClient = {
	get: <T = unknown>(
		url: string,
		config?: AxiosRequestConfig,
	) => Promise<AxiosResponse<T>>;
	delete: <T = unknown>(
		url: string,
		config?: AxiosRequestConfig,
	) => Promise<AxiosResponse<T>>;
	put: <T = unknown>(
		url: string,
		body?: unknown,
		config?: AxiosRequestConfig,
	) => Promise<AxiosResponse<T>>;
	post: <T = unknown>(
		url: string,
		body?: unknown,
		config?: AxiosRequestConfig,
	) => Promise<AxiosResponse<T>>;
	patch: <T = unknown>(
		url: string,
		body?: unknown,
		config?: AxiosRequestConfig,
	) => Promise<AxiosResponse<T>>;
	// Whether the session still holds the token this client was made with:
	// false after a logout or another login
	stillCurrent: () => boolean;
};

const CREDENTIAL_HEADERS = ["Authorization", "X-Nostr-Authorization"];

const scrub = (error: unknown): unknown => {
	if (!isAxiosError(error)) return error;
	for (const config of [error.config, error.response?.config]) {
		if (!config) continue;
		for (const name of CREDENTIAL_HEADERS) {
			if (typeof config.headers?.delete === "function") {
				config.headers.delete(name);
			} else if (config.headers) {
				delete (config.headers as Record<string, unknown>)[name];
			}
		}
		config.data = undefined;
	}
	return error;
};

const withAuth = (
	token: Session["token"],
	config: AxiosRequestConfig | undefined,
	retry: boolean,
): AxiosRequestConfig => ({
	...config,
	headers: { ...config?.headers, Authorization: `Bearer ${token}` },
	// The api instance retries network errors on any method. A POST or PATCH
	// that timed out may still have landed, and a retry would create a second
	// submission, note or photo.
	...(!retry && { "axios-retry": { retries: 0 } }),
});

// A client for the signed-in session, or for `token` when the caller follows
// a session store of its own (e.g. the notes store). Throws NotSignedInError
// when there is no session.
export const authedClient = (token?: Session["token"]): AuthedClient => {
	const pinned = token ?? get(session)?.token;
	if (!pinned) throw new NotSignedInError();

	const send = <T>(request: Promise<AxiosResponse<T>>) =>
		request.catch((error: unknown) => {
			throw scrub(error);
		});

	return {
		get: (url, config) => send(api.get(url, withAuth(pinned, config, true))),
		delete: (url, config) =>
			send(api.delete(url, withAuth(pinned, config, true))),
		put: (url, body, config) =>
			send(api.put(url, body, withAuth(pinned, config, true))),
		post: (url, body, config) =>
			send(api.post(url, body, withAuth(pinned, config, false))),
		patch: (url, body, config) =>
			send(api.patch(url, body, withAuth(pinned, config, false))),
		stillCurrent: () => get(session)?.token === pinned,
	};
};
