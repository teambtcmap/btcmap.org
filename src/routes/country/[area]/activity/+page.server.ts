import { loadCountryArea } from "#lib/area/routeConfigs.js";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) =>
	loadCountryArea({ params, fetch }, "activity");
