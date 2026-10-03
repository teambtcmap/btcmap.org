import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";

// The signed-in user's id and roles. The session only keeps the username
// and token, but ownership checks (e.g. who may delete a place photo) need
// the numeric id that the API attributes content to.
export type CurrentUser = { id: number; roles: string[] };

// One request per token for a few minutes, so a role change (e.g. a new
// admin, or a revoked one) applies without a reload; failures aren't
// cached, so a later call retries
const CACHE_MS = 5 * 60_000;
const cache = new Map<
	string,
	{ at: number; request: Promise<CurrentUser | null> }
>();

export const resetCurrentUserCache = () => cache.clear();

const parse = (data: unknown): CurrentUser | null => {
	if (typeof data !== "object" || data === null) return null;
	const { id, roles } = data as Record<string, unknown>;
	if (typeof id !== "number") return null;
	return {
		id,
		roles: Array.isArray(roles)
			? roles.filter((role): role is string => typeof role === "string")
			: [],
	};
};

export const fetchCurrentUser = (
	token: string,
): Promise<CurrentUser | null> => {
	const cached = cache.get(token);
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.request;
	const request = api
		.get<unknown>(`${API_BASE}/v4/users/me`, {
			headers: { Authorization: `Bearer ${token}` },
		})
		.then((res) => parse(res.data))
		.catch((error) => {
			console.error("current user: lookup failed", error);
			return null;
		})
		.then((user) => {
			if (!user) cache.delete(token);
			return user;
		});
	cache.set(token, { at: Date.now(), request });
	return request;
};
