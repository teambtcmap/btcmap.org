import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { AxiosHeaders, isAxiosError } from "axios";
import { get } from "svelte/store";

import api from "#lib/axios.js";
import type { Session } from "#lib/session.js";
import { session } from "#lib/session.js";

// Calls to the btcmap API as the signed-in user (#1348: straight from the
// client with the Bearer token). Callers never see the token: a client is
// pinned to one session's token when it is made, so every call of a flow
// (an upload and its undo, a request and the store write after it) goes out
// as the same account, and stillCurrent() says whether that account is
// still the one signed in; once it isn't, the client sends nothing more.
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

// The client's session ended (logout, another login) before a call went out
export class SessionChangedError extends Error {
	constructor() {
		super("the session this client was made for has ended");
		this.name = "SessionChangedError";
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

const CREDENTIAL_HEADERS = new Set(["authorization", "x-nostr-authorization"]);

const scrubHeaders = (headers: unknown) => {
	if (typeof headers !== "object" || headers === null) return;
	// AxiosHeaders (what axios turns every config's headers into) matches
	// names case-insensitively; a plain object is walked key by key
	if (headers instanceof AxiosHeaders) {
		for (const name of CREDENTIAL_HEADERS) headers.delete(name);
		return;
	}
	const record = headers as Record<string, unknown>;
	for (const name of Object.keys(record)) {
		if (CREDENTIAL_HEADERS.has(name.toLowerCase())) delete record[name];
	}
};

const scrub = (error: unknown): unknown => {
	if (!isAxiosError(error)) return error;
	for (const config of [error.config, error.response?.config]) {
		if (!config) continue;
		scrubHeaders(config.headers);
		config.data = undefined;
	}
	// The transport's own request object: in Node it keeps the raw request
	// headers, Bearer included. Nothing reads it.
	error.request = undefined;
	if (error.response) error.response.request = undefined;
	// Node's adapter keeps the underlying error, request included
	error.cause = undefined;
	return error;
};

// The api instance retries network errors on any method, and 5xx on GET,
// PUT and DELETE. Only reads and deletes go again here: a POST or PATCH that
// timed out may still have landed (a second submission, note or photo), and
// the account PUTs carry credentials — a password change would be resent
// with both passwords, then refused as "wrong password" though it worked.
type Retry = "retry" | "noRetry";

const withAuth = (
	token: Session["token"],
	config: AxiosRequestConfig | undefined,
	retry: Retry,
): AxiosRequestConfig => ({
	...config,
	headers: { ...config?.headers, Authorization: `Bearer ${token}` },
	...(retry === "noRetry" && { "axios-retry": { retries: 0 } }),
});

// A client for the signed-in session, or for `token` when the caller follows
// a session store of its own (the notes store, the current-user cache).
// Throws NotSignedInError when there is no session.
export const authedClient = (token?: Session["token"]): AuthedClient => {
	const pinned = token ?? get(session)?.token;
	if (!pinned) throw new NotSignedInError();
	const stillCurrent = () => get(session)?.token === pinned;

	// A client pinned from the session sends nothing once that session is
	// gone: after a logout whose revoke failed, the token still works, and a
	// late Undo or a queued upload must not act for the previous user. One
	// made for an explicit token follows its caller's own session store.
	const send = <T>(request: () => Promise<AxiosResponse<T>>) => {
		if (token === undefined && !stillCurrent()) {
			return Promise.reject(new SessionChangedError());
		}
		return request().catch((error: unknown) => {
			throw scrub(error);
		});
	};

	return {
		get: (url, config) =>
			send(() => api.get(url, withAuth(pinned, config, "retry"))),
		delete: (url, config) =>
			send(() => api.delete(url, withAuth(pinned, config, "retry"))),
		put: (url, body, config) =>
			send(() => api.put(url, body, withAuth(pinned, config, "noRetry"))),
		post: (url, body, config) =>
			send(() => api.post(url, body, withAuth(pinned, config, "noRetry"))),
		patch: (url, body, config) =>
			send(() => api.patch(url, body, withAuth(pinned, config, "noRetry"))),
		stillCurrent,
	};
};
