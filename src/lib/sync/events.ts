import { eventError, events } from "$lib/store";
import type { Event } from "$lib/types";

import { createSyncFunction } from "./createSyncFactory";

export const eventsSync = createSyncFunction<Event>({
	name: "events",
	storageKey: "events_v4",
	apiEndpoint: "events",
	limit: 50000,
	store: events,
	errorStore: eventError,
	filterDeleted: (event) => !event.deleted_at,
	legacyTables: ["events", "events_v2", "events_v3"],
});
