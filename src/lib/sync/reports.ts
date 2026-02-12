import { reportError, reports } from "$lib/store";
import type { Report } from "$lib/types";

import { createSyncFunction } from "./createSyncFactory";

export const reportsSync = createSyncFunction<Report>({
	name: "reports",
	storageKey: "reports_v6",
	apiEndpoint: "reports",
	limit: 10000,
	store: reports,
	errorStore: reportError,
	filterDeleted: (report) => !report.deleted_at,
	legacyTables: [
		"reports",
		"reports_v2",
		"reports_v3",
		"reports_v4",
		"reports_v5",
	],
});
