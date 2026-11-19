import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlacesLoadingStatus } from "#lib/store.js";
import {
	places,
	placesError,
	placesLoadingProgress,
	placesLoadingStatus,
} from "#lib/store.js";
import type { Place, ProgressUpdate } from "#lib/types.js";

vi.mock("#lib/axios.js", () => ({
	default: { get: vi.fn(), head: vi.fn() },
}));
vi.mock("#lib/sync/clearTables.js", () => ({ clearTables: vi.fn() }));
vi.mock("#lib/sync/placeCache.js", () => ({
	publishPlaces: vi.fn(),
	readPlaceCache: vi.fn(),
	readPlacesSyncedAt: vi.fn(),
	writePlacesSyncedAt: vi.fn(),
}));
vi.mock("#lib/workers/sync-worker-manager.js", () => ({
	filterPlaces: vi.fn(),
	parseJSON: vi.fn(),
}));
// The root layout starts the sync in onMount, before the first locale has
// loaded. svelte-i18n throws on any message lookup then, so the sync must
// not translate: every test here runs with a locale that is not ready.
vi.mock("#lib/i18n/index.js", async () => {
	const { readable } = await import("svelte/store");
	const notReady = () => {
		throw new Error(
			"[svelte-i18n] Cannot format a message without first setting the initial locale.",
		);
	};
	return { _: readable(notReady), locale: readable(undefined) };
});

import api from "#lib/axios.js";
import {
	publishPlaces,
	readPlaceCache,
	readPlacesSyncedAt,
	writePlacesSyncedAt,
} from "#lib/sync/placeCache.js";
import { parseJSON } from "#lib/workers/sync-worker-manager.js";

import { elementsSync } from "./places";

const row = (id: number): Place => ({ id, lat: 0, lon: 0 }) as Place;

// Every status the loading box would show, in order.
const recordStatuses = () => {
	const seen: PlacesLoadingStatus[] = [];
	const unsubscribe = placesLoadingStatus.subscribe((status) => {
		if (status) seen.push(status);
	});
	return { seen, unsubscribe };
};

describe("elementsSync loading status", () => {
	beforeEach(() => {
		vi.mocked(api.get).mockReset();
		vi.mocked(readPlaceCache).mockReset();
		vi.mocked(readPlacesSyncedAt).mockReset();
		vi.mocked(writePlacesSyncedAt).mockImplementation(async (iso) => iso);
		vi.mocked(publishPlaces).mockResolvedValue({ persisted: true });
		places.set([]);
		placesError.set("");
		placesLoadingProgress.set(0);
		placesLoadingStatus.set(null);
	});

	it("runs to the end before the app locale has loaded", async () => {
		places.set([row(1)]);
		vi.mocked(readPlaceCache).mockResolvedValue([row(1)]);
		vi.mocked(readPlacesSyncedAt).mockResolvedValue(new Date().toISOString());
		vi.mocked(api.get).mockResolvedValue({ data: [] });

		await elementsSync();

		expect(get(placesError)).toBe("");
		expect(get(placesLoadingProgress)).toBe(100);
		expect(get(placesLoadingStatus)).toEqual({ key: "status.complete" });
	});

	it("reports the cached-sync steps as i18n keys", async () => {
		places.set([row(1)]);
		vi.mocked(readPlaceCache).mockResolvedValue([row(1)]);
		vi.mocked(readPlacesSyncedAt).mockResolvedValue(new Date().toISOString());
		vi.mocked(api.get).mockResolvedValue({ data: [] });

		const { seen, unsubscribe } = recordStatuses();
		await elementsSync();
		unsubscribe();

		expect(seen).toEqual([
			{ key: "status.initializing" },
			{ key: "status.loadingFromCache" },
			{ key: "status.checkingUpdates" },
			{ key: "status.finalizing" },
			{ key: "status.complete" },
		]);
	});

	it("reports the download and parse progress with raw numbers", async () => {
		vi.mocked(readPlaceCache).mockResolvedValue(null);
		vi.mocked(readPlacesSyncedAt).mockResolvedValue(null);
		vi.mocked(api.head).mockResolvedValue({
			headers: { "last-modified": new Date().toUTCString() },
		});
		vi.mocked(api.get)
			// The CDN baseline: one progress event, half of 3 MB loaded
			.mockImplementationOnce(async (_url, config) => {
				config?.onDownloadProgress?.({
					loaded: 1.5 * 1024 * 1024,
					total: 3 * 1024 * 1024,
				} as never);
				return { data: "[]" };
			})
			// The updates since the baseline
			.mockResolvedValueOnce({ data: [] });
		const parsing: ProgressUpdate = {
			percent: 50,
			itemsParsed: 1234,
			status: "parsing",
		};
		vi.mocked(parseJSON).mockImplementation(
			async (_text, _kind, onProgress) => {
				onProgress?.(parsing);
				return [row(1)] as never;
			},
		);

		const { seen, unsubscribe } = recordStatuses();
		await elementsSync();
		unsubscribe();

		expect(seen).toEqual([
			{ key: "status.initializing" },
			{ key: "status.downloading" },
			{ key: "status.downloadingProgress", values: { loaded: 1.5, total: 3 } },
			{ key: "status.processing" },
			{ key: "status.processingCount", values: { count: 1234 } },
			{ key: "status.checkingUpdates" },
			{ key: "status.finalizing" },
			{ key: "status.complete" },
		]);
	});
});
