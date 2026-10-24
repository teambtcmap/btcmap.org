import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";

import { authedClient } from "./authedApi";
import {
	addSavedItem,
	fetchSavedLists,
	hydrateSavedFromServer,
	removeSavedItem,
	setSavedList,
} from "./savedItems";
import { session } from "./session";

vi.mock("#lib/axios.js", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(async () => ({ data: [5] })),
		delete: vi.fn(async () => ({ data: [] })),
	},
}));

beforeEach(() => {
	localStorage.clear();
	session.login("alice", "tok");
});

describe("addSavedItem", () => {
	it("POSTs the id as explicit JSON — axios would form-encode a bare number", async () => {
		const { default: api } = await import("#lib/axios.js");
		const ids = await addSavedItem("place", 5);

		expect(api.post).toHaveBeenCalledWith(
			`${API_BASE}/v4/places/saved`,
			JSON.stringify(5),
			{
				headers: {
					Authorization: "Bearer tok",
					"Content-Type": "application/json",
				},
				"axios-retry": { retries: 0 },
			},
		);
		expect(ids).toEqual([5]);
	});
});

describe("removeSavedItem", () => {
	it("DELETEs the per-id endpoint with the Bearer token", async () => {
		const { default: api } = await import("#lib/axios.js");
		const ids = await removeSavedItem("area", 7);

		expect(api.delete).toHaveBeenCalledWith(`${API_BASE}/v4/areas/saved/7`, {
			headers: { Authorization: "Bearer tok" },
		});
		expect(ids).toEqual([]);
	});
});

describe("hydrateSavedFromServer", () => {
	it("fills the session with the ids of both lists", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockImplementation(async (url) => ({
			data: url.includes("places") ? [{ id: 1 }, { id: 2 }] : [{ id: 9 }],
		}));

		expect(await hydrateSavedFromServer()).toEqual({ place: true, area: true });
		expect(get(session)).toMatchObject({
			savedPlaces: [1, 2],
			savedAreas: [9],
		});
	});

	it("reports a failed or malformed list and leaves it alone", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockImplementation(async (url) => {
			if (url.includes("places")) throw new Error("offline");
			return { data: "<html>" };
		});

		expect(await hydrateSavedFromServer()).toEqual({
			place: false,
			area: false,
		});
		expect(get(session)).toMatchObject({ savedPlaces: [], savedAreas: [] });
	});

	// Lists for alice must not land in bob's session
	it("drops lists that arrive after another login", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockImplementation(async () => {
			session.login("bob", "tok2");
			return { data: [{ id: 1 }] };
		});

		await hydrateSavedFromServer();
		expect(get(session)).toMatchObject({
			username: "bob",
			savedPlaces: [],
			savedAreas: [],
		});
	});
});

describe("setSavedList", () => {
	it("writes the list while the client's account is signed in", () => {
		setSavedList("place", [3], authedClient());
		expect(get(session)?.savedPlaces).toEqual([3]);
	});

	// A save that answers after another login must not write alice's list
	// into bob's session — the server list, or the rollback of a failure
	it("drops a list for an account that is no longer signed in", () => {
		const client = authedClient();
		session.login("bob", "tok2");

		setSavedList("place", [3], client);
		setSavedList("area", [7], client);

		expect(get(session)).toMatchObject({
			username: "bob",
			savedPlaces: [],
			savedAreas: [],
		});
	});
});

describe("fetchSavedLists", () => {
	it("settles both lists on their own", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockImplementation(async (url) => {
			if (url.includes("areas")) throw new Error("offline");
			return { data: [{ id: 1, name: "Cafe" }] };
		});

		const [places, areas] = await fetchSavedLists();

		expect(places).toEqual({
			status: "fulfilled",
			value: [{ id: 1, name: "Cafe" }],
		});
		expect(areas.status).toBe("rejected");
	});
});
