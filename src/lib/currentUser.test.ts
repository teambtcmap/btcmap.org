import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";

import { fetchCurrentUser, resetCurrentUserCache } from "./currentUser";

vi.mock("#lib/axios.js", () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
	vi.clearAllMocks();
	resetCurrentUserCache();
});

describe("fetchCurrentUser", () => {
	it("reads id and roles from /v4/users/me with the Bearer token", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({
			data: { id: 17, name: "satoshi", roles: ["user", "admin"] },
		});

		expect(await fetchCurrentUser("tok")).toEqual({
			id: 17,
			roles: ["user", "admin"],
		});
		expect(api.get).toHaveBeenCalledWith(`${API_BASE}/v4/users/me`, {
			headers: { Authorization: "Bearer tok" },
		});
	});

	it("asks the API once per token", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: { id: 17, roles: [] } });

		await fetchCurrentUser("tok");
		await fetchCurrentUser("tok");
		expect(api.get).toHaveBeenCalledOnce();

		await fetchCurrentUser("other");
		expect(api.get).toHaveBeenCalledTimes(2);
	});

	it("asks again after the cache expires, so role changes apply without a reload", async () => {
		vi.useFakeTimers();
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: { id: 17, roles: [] } });

		await fetchCurrentUser("tok");
		vi.advanceTimersByTime(4 * 60_000);
		await fetchCurrentUser("tok");
		expect(api.get).toHaveBeenCalledOnce();

		vi.advanceTimersByTime(2 * 60_000);
		await fetchCurrentUser("tok");
		expect(api.get).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it("is null for an unexpected response or a failed request, and retries later", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValueOnce({ data: "<html>" });
		expect(await fetchCurrentUser("tok")).toBeNull();

		vi.mocked(api.get).mockRejectedValueOnce(new Error("401"));
		expect(await fetchCurrentUser("tok")).toBeNull();
		expect(api.get).toHaveBeenCalledTimes(2);
	});

	it("reads whether the account has a password", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValueOnce({
			data: { id: 1, roles: [], has_password: false },
		});
		vi.mocked(api.get).mockResolvedValueOnce({
			data: { id: 2, roles: [], has_password: true },
		});

		expect((await fetchCurrentUser("nostr"))?.hasPassword).toBe(false);
		expect((await fetchCurrentUser("password"))?.hasPassword).toBe(true);
	});

	// An API without has_password (before teambtcmap/btcmap-api#120) can't
	// tell, so callers treat the account as a password account
	it("leaves hasPassword undefined when the API doesn't send it", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: { id: 1, roles: [] } });

		expect((await fetchCurrentUser("tok"))?.hasPassword).toBeUndefined();
	});

	it("drops non-string and unknown roles", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({
			data: { id: 1, roles: ["admin", 5, null, "Admin", "superuser"] },
		});
		expect(await fetchCurrentUser("tok")).toEqual({ id: 1, roles: ["admin"] });
	});

	it("keeps every role the API defines", async () => {
		const { default: api } = await import("#lib/axios.js");
		const all = [
			"user",
			"admin",
			"root",
			"places_source",
			"event_manager",
			"area_manager",
			"dashboard",
		];
		vi.mocked(api.get).mockResolvedValue({ data: { id: 1, roles: all } });
		expect(await fetchCurrentUser("tok")).toEqual({ id: 1, roles: all });
	});
});
