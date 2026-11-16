import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";

import { fetchCurrentUser, resetCurrentUserCache } from "./currentUser";
import { session } from "./session";
import type { Role } from "$types/btcmap-api/Role";

vi.mock("#lib/axios.js", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

beforeEach(() => {
	vi.clearAllMocks();
	resetCurrentUserCache();
	localStorage.clear();
	session.login("satoshi", "tok");
});

describe("fetchCurrentUser", () => {
	it("reads id and roles from /v4/users/me with the Bearer token", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({
			data: { id: 17, name: "satoshi", roles: ["user", "admin"] },
		});

		expect(await fetchCurrentUser()).toEqual({
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

		await fetchCurrentUser();
		await fetchCurrentUser();
		expect(api.get).toHaveBeenCalledOnce();

		session.login("hal", "other");
		await fetchCurrentUser();
		expect(api.get).toHaveBeenCalledTimes(2);
	});

	it("asks again after the cache expires, so role changes apply without a reload", async () => {
		vi.useFakeTimers();
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: { id: 17, roles: [] } });

		await fetchCurrentUser();
		vi.advanceTimersByTime(4 * 60_000);
		await fetchCurrentUser();
		expect(api.get).toHaveBeenCalledOnce();

		vi.advanceTimersByTime(2 * 60_000);
		await fetchCurrentUser();
		expect(api.get).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it("is null for an unexpected response or a failed request, and retries later", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValueOnce({ data: "<html>" });
		expect(await fetchCurrentUser()).toBeNull();

		vi.mocked(api.get).mockRejectedValueOnce(new Error("401"));
		expect(await fetchCurrentUser()).toBeNull();
		expect(api.get).toHaveBeenCalledTimes(2);
	});

	it("is null when signed out, without a request", async () => {
		const { default: api } = await import("#lib/axios.js");
		await session.logout();

		expect(await fetchCurrentUser()).toBeNull();
		expect(api.get).not.toHaveBeenCalled();
	});

	it("drops non-string and unknown roles", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({
			data: { id: 1, roles: ["admin", 5, null, "Admin", "superuser"] },
		});
		expect(await fetchCurrentUser()).toEqual({ id: 1, roles: ["admin"] });
	});

	it("drops role names every object inherits", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({
			data: {
				id: 1,
				roles: [
					"constructor",
					"toString",
					"__proto__",
					"hasOwnProperty",
					"admin",
				],
			},
		});
		expect(await fetchCurrentUser()).toEqual({ id: 1, roles: ["admin"] });
	});

	it("keeps every role the API defines", async () => {
		const { default: api } = await import("#lib/axios.js");
		// Checked against the generated Role: a role the API adds fails the
		// typecheck here until this list has it too
		const all = Object.keys({
			user: true,
			admin: true,
			root: true,
			places_source: true,
			event_manager: true,
			area_manager: true,
			dashboard: true,
		} satisfies Record<Role, true>);
		vi.mocked(api.get).mockResolvedValue({ data: { id: 1, roles: all } });
		expect(await fetchCurrentUser()).toEqual({ id: 1, roles: all });
	});
});
