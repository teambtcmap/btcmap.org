import { loadCommunityArea } from "$lib/area/routeConfigs";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) =>
	loadCommunityArea({ params, fetch }, "stats");
