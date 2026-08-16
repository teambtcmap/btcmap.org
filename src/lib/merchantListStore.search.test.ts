import { get } from "svelte/store";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Place } from "$lib/types";

// Mock the centralized axios instance
vi.mock("$lib/axios", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
	},
}));

import api from "$lib/axios";

// Mock i18n to avoid intl-messageformat module resolution in tests
vi.mock("$lib/i18n", () => {
	const { writable } = require("svelte/store");
	const mockT = (key: string) => key;
	return { _: writable(mockT) };
});

// Mock errToast and let calculateDistance/debounce pass through unmocked —
// the debounce IS the thing under test.
vi.mock("$lib/utils", async () => {
	const actual = await vi.importActual("$lib/utils");
	return {
		...actual,
		errToast: vi.fn(),
	};
});

// Mock isBoosted from merchantDrawerLogic — merchantListStore imports it
// unconditionally, and the real module pulls in $app/environment
// transitively (merchantDrawerHash.ts), which crashes at import time
// outside a SvelteKit runtime.
vi.mock("$lib/merchantDrawerLogic", () => ({
	isBoosted: (place: Place) =>
		place.boosted_until && new Date(place.boosted_until) > new Date(),
}));

// Hoisted so the vi.mock factory below can reference it before module init
const { mockUserLocationStore } = vi.hoisted(() => {
	const { writable } = require("svelte/store");
	return {
		mockUserLocationStore: writable({
			location: null as { lat: number; lon: number } | null,
			lastUpdated: null as number | null,
			usesMetricSystem: null as boolean | null,
		}),
	};
});

// Mock userLocationStore - matches real module shape: { subscribe, getLocationWithCache, setLocation }
vi.mock("$lib/userLocationStore", () => {
	return {
		userLocation: {
			subscribe: mockUserLocationStore.subscribe,
			getLocationWithCache: vi.fn().mockResolvedValue(null),
			setLocation: vi.fn(),
		},
	};
});

vi.mock("$lib/merchantDrawerStore", () => ({
	merchantDrawer: { close: vi.fn(), open: vi.fn() },
}));
vi.mock("$lib/analytics", () => ({ trackEvent: vi.fn() }));

import { trackEvent } from "$lib/analytics";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import { errToast } from "$lib/utils";

// Import after mocks are set up
import { merchantList } from "./merchantListStore";

const okResponse = (places: unknown[], total = places.length) =>
	new Response(JSON.stringify({ places, total }), { status: 200 });

const place = (id: number, name = `Place ${id}`) =>
	({ id, name, lat: 1, lon: 2, icon: "store", tags: {} }) as unknown as Place;

// search() arms a 300 ms trailing debounce; dispatch = advance past it and
// flush the async fetch chain.
const dispatch = () => vi.advanceTimersByTimeAsync(300);

describe("merchantListStore — searchSession", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse([])));
		merchantList.reset();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("search() writes the raw query synchronously", () => {
		merchantList.search("  El Zonte");

		expect(get(merchantList).searchQuery).toBe("  El Zonte");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("short queries fall back to nearby without touching results or isOpen", async () => {
		merchantList.openWithSearchResults("prev", [place(1)]);

		merchantList.search("ab");
		const state = get(merchantList);

		expect(state.mode).toBe("nearby");
		expect(state.searchQuery).toBe("ab");
		expect(state.searchResults.length).toBe(1);
		expect(state.searchTotal).toBe(1);
		expect(state.isOpen).toBe(true);

		await dispatch();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("a short query cancels an armed search", async () => {
		merchantList.search("El Zonte", {});
		merchantList.search("El");

		await dispatch();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("dispatch happens once, 300 ms after the last keystroke", async () => {
		merchantList.search("El Zo");
		merchantList.search("El Zon");
		merchantList.search("El Zonte");

		expect(get(merchantList).isSearching).toBe(false);
		expect(fetch).not.toHaveBeenCalled();

		await dispatch();

		expect(fetch).toHaveBeenCalledTimes(1);
		const url = (fetch as Mock).mock.calls[0][0] as string;
		expect(new URL(url, "http://localhost").searchParams.get("name")).toBe(
			"El Zonte",
		);
	});

	it("dispatch-time side effects fire at dispatch, not at the keystroke", async () => {
		merchantList.search("El Zonte");

		expect(trackEvent).not.toHaveBeenCalled();
		expect(merchantDrawer.close).not.toHaveBeenCalled();
		expect(get(merchantList).isSearching).toBe(false);

		await dispatch();

		expect(trackEvent).toHaveBeenCalledTimes(1);
		expect(merchantDrawer.close).toHaveBeenCalledTimes(1);
		const state = get(merchantList);
		expect(state.mode).toBe("search");
		expect(state.isOpen).toBe(true);
	});

	it("getCenter is evaluated at dispatch time and omitted when undefined", async () => {
		let center: { lat: number; lon: number } | undefined;
		merchantList.search("El Zonte", { getCenter: () => center });
		center = { lat: 9, lon: -89 };

		await dispatch();

		const firstUrl = (fetch as Mock).mock.calls[0][0] as string;
		const firstParams = new URL(firstUrl, "http://localhost").searchParams;
		expect(firstParams.get("lat")).toBe("9");
		expect(firstParams.get("lon")).toBe("-89");

		merchantList.search("Other query", { getCenter: () => undefined });
		await dispatch();

		const secondUrl = (fetch as Mock).mock.calls[1][0] as string;
		const secondParams = new URL(secondUrl, "http://localhost").searchParams;
		expect(secondParams.has("lat")).toBe(false);
		expect(secondParams.has("lon")).toBe(false);
	});

	it("a successful response opens the results", async () => {
		(fetch as Mock).mockResolvedValue(okResponse([place(1), place(2)], 40));

		merchantList.search("El Zonte");
		await dispatch();

		const state = get(merchantList);
		expect(state.searchResults.length).toBe(2);
		expect(state.searchTotal).toBe(40);
		expect(state.isSearching).toBe(false);
		expect(state.mode).toBe("search");
		expect(state.isOpen).toBe(true);
	});

	it("a response for a superseded query is dropped", async () => {
		let resolveFetch!: (value: Response) => void;
		(fetch as Mock).mockImplementationOnce(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				}),
		);

		merchantList.search("kiosk");
		await dispatch(); // request now in flight

		merchantList.search("kiosk hamburg"); // writes new query, arms new debounce

		resolveFetch(okResponse([place(1)], 1));
		await vi.advanceTimersByTimeAsync(0);

		const state = get(merchantList);
		expect(state.searchQuery).toBe("kiosk hamburg");
		expect(state.searchResults).toEqual([]);
	});

	it("a late response after close cannot reopen the panel", async () => {
		let resolveFetch!: (value: Response) => void;
		(fetch as Mock).mockImplementationOnce(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				}),
		);

		merchantList.search("El Zonte");
		await dispatch(); // request in flight, abort signal ignored by the mock

		merchantList.close();
		resolveFetch(okResponse([place(1)], 1));
		await vi.advanceTimersByTimeAsync(0);

		const state = get(merchantList);
		expect(state.isOpen).toBe(false);
		expect(state.mode).toBe("nearby");
		expect(state.searchResults).toEqual([]);
	});

	it("abort errors are silent", async () => {
		// jsdom's DOMException does not extend Error (unlike Node's native
		// DOMException and real browsers, verified separately) — construct the
		// rejection the way the rest of this suite already does, so we exercise
		// the store's `error instanceof Error && error.name === "AbortError"`
		// guard without that environment artifact.
		const abortError = new Error("aborted");
		abortError.name = "AbortError";
		(fetch as Mock).mockRejectedValue(abortError);

		merchantList.search("El Zonte");
		await dispatch();

		expect(errToast).not.toHaveBeenCalled();
		// TODAY's ported behavior: the AbortError branch returns early, before
		// setSearchModeOpen(false) — the aborting caller owns clearing the
		// spinner, so isSearching stays true from setSearchModeOpen(true) at
		// dispatch.
		expect(get(merchantList).isSearching).toBe(true);
	});

	it("failures toast and clear the spinner but keep query and mode", async () => {
		(fetch as Mock).mockResolvedValue(new Response("", { status: 502 }));

		merchantList.search("El Zonte");
		await dispatch();

		expect(errToast).toHaveBeenCalledTimes(1);
		const state = get(merchantList);
		expect(state.isSearching).toBe(false);
		expect(state.mode).toBe("search");
		expect(state.searchQuery).toBe("El Zonte");
		expect(state.isOpen).toBe(true);
	});

	it("a failure for a superseded query is silent", async () => {
		let resolveFetch!: (value: Response) => void;
		(fetch as Mock).mockImplementationOnce(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				}),
		);

		merchantList.search("kiosk");
		await dispatch();

		merchantList.search("kiosk hamburg");

		resolveFetch(new Response("", { status: 502 }));
		await vi.advanceTimersByTimeAsync(0);

		expect(errToast).not.toHaveBeenCalled();
	});

	it("cancelSearch() cancels an armed search", async () => {
		merchantList.search("El Zonte");
		merchantList.cancelSearch();

		await dispatch();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("close() cancels the pending search but not the list fetch", async () => {
		let listAborted = false;
		(api.get as Mock).mockImplementationOnce(
			(_url: string, config: { signal: AbortSignal }) =>
				new Promise((resolve) => {
					config.signal.addEventListener("abort", () => {
						listAborted = true;
					});
					setTimeout(() => resolve({ data: [] }), 50);
				}),
		);

		merchantList.search("El Zonte");
		const listPromise = merchantList.fetchAndReplaceList(
			{ lat: 0, lon: 0 },
			10,
		);
		merchantList.close();

		await dispatch();
		await listPromise;

		expect(fetch).not.toHaveBeenCalled();
		expect(listAborted).toBe(false);
	});

	it("reset() cancels an armed search", async () => {
		merchantList.search("El Zonte");
		merchantList.reset();

		await dispatch();
		expect(fetch).not.toHaveBeenCalled();
	});
});
