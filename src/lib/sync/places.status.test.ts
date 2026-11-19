import { beforeEach, describe, expect, it, vi } from "vitest";

import { places, placesLoadingStatus } from "#lib/store.js";
import type { Place } from "#lib/types.js";

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
// The translator echoes the key and its values, so a test can see which
// i18n key fed which status.
vi.mock("#lib/i18n/index.js", async () => {
	const { readable } = await import("svelte/store");
	return {
		_: readable(
			(key: string, options?: { values?: Record<string, unknown> }) =>
				options?.values
					? `t(${key}, ${JSON.stringify(options.values)})`
					: `t(${key})`,
		),
	};
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

// Every non-empty status the loading box would show, in order.
const recordStatuses = () => {
	const seen: string[] = [];
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
		placesLoadingStatus.set("");
	});

	it("shows the cached-sync steps in the app language", async () => {
		places.set([row(1)]);
		vi.mocked(readPlaceCache).mockResolvedValue([row(1)]);
		vi.mocked(readPlacesSyncedAt).mockResolvedValue(new Date().toISOString());
		vi.mocked(api.get).mockResolvedValue({ data: [] });

		const { seen, unsubscribe } = recordStatuses();
		await elementsSync();
		unsubscribe();

		expect(seen).toEqual([
			"t(status.initializing)",
			"t(status.loadingFromCache)",
			"t(status.checkingUpdates)",
			"t(status.finalizing)",
			"t(status.complete)",
		]);
	});

	it("shows the download and parse progress in the app language", async () => {
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
		vi.mocked(parseJSON).mockImplementation(
			async (_text, _kind, onProgress) => {
				onProgress?.({ percent: 50, itemsParsed: 1234 } as never);
				return [row(1)] as never;
			},
		);

		const { seen, unsubscribe } = recordStatuses();
		await elementsSync();
		unsubscribe();

		expect(seen).toEqual([
			"t(status.initializing)",
			"t(status.downloading)",
			't(status.downloadingProgress, {"loaded":"1.5","total":"3.0"})',
			"t(status.processing)",
			`t(status.processingCount, {"count":"${(1234).toLocaleString()}"})`,
			"t(status.checkingUpdates)",
			"t(status.finalizing)",
			"t(status.complete)",
		]);
	});
});
