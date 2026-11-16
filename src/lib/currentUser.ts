import { get } from "svelte/store";

import { API_BASE } from "#lib/api-base.js";
import { errorStatus } from "#lib/apiError.js";
import { authedClient } from "#lib/authedApi.js";
import { session } from "#lib/session.js";

import type { Role } from "$types/btcmap-api/Role";

// The signed-in user's id and roles. The session only keeps the username
// and token, but ownership checks (e.g. who may delete a place photo) need
// the numeric id that the API attributes content to.
export type CurrentUser = { id: number; roles: Role[] };

// Every role of the generated Role type, as a value to filter with: a role
// the API adds fails the typecheck here until it's listed. A role from a
// newer API than these bindings is dropped rather than trusted.
const KNOWN_ROLES: Record<Role, true> = {
	user: true,
	admin: true,
	root: true,
	places_source: true,
	event_manager: true,
	area_manager: true,
	dashboard: true,
};

const isRole = (value: unknown): value is Role =>
	typeof value === "string" && Object.hasOwn(KNOWN_ROLES, value);

// One request per token for a few minutes, so a role change (e.g. a new
// admin, or a revoked one) applies without a reload; failures aren't
// cached, so a later call retries
const CACHE_MS = 5 * 60_000;
const cache = new Map<
	string,
	{ at: number; request: Promise<CurrentUser | null> }
>();

export const resetCurrentUserCache = () => cache.clear();

const parseCurrentUser = (data: unknown): CurrentUser | null => {
	if (typeof data !== "object" || data === null) return null;
	const { id, roles } = data as Record<string, unknown>;
	if (typeof id !== "number") return null;
	return {
		id,
		roles: Array.isArray(roles) ? roles.filter(isRole) : [],
	};
};

// The signed-in user, or null when signed out or the lookup failed
export const fetchCurrentUser = (): Promise<CurrentUser | null> => {
	const token = get(session)?.token;
	if (!token) return Promise.resolve(null);
	const cached = cache.get(token);
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.request;
	const request = authedClient(token)
		.get<unknown>(`${API_BASE}/v4/users/me`)
		.then((res) => parseCurrentUser(res.data))
		.catch((error) => {
			console.error("current user: lookup failed", errorStatus(error));
			return null;
		})
		.then((user) => {
			if (!user) cache.delete(token);
			return user;
		});
	cache.set(token, { at: Date.now(), request });
	return request;
};
