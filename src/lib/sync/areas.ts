import { serverCache } from "$lib/cache";
import { areaError, areas } from "$lib/store";
import type { Area } from "$lib/types";

import { createSyncFunction } from "./createSyncFactory";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const areasSync = createSyncFunction<Area>({
	name: "areas",
	storageKey: "areas_v4",
	apiEndpoint: "areas",
	limit: 500,
	store: areas,
	errorStore: areaError,
	filterDeleted: (area) => !area.deleted_at && area.tags?.type !== "trash",
	legacyTables: ["areas", "areas_v2", "areas_v3"],
	serverCache: {
		get: () => serverCache.getAreas(),
		set: (data) => serverCache.setAreas(data),
		getLastSync: () => serverCache.getLastSync(),
	},
	cacheDuration: CACHE_DURATION,
});
