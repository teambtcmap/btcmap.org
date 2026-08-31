import { redirect } from "@sveltejs/kit";

import { parseCoordsParams } from "$lib/placementMode";

import type { PageLoad } from "./$types";

// One placement UI in the system: the form only ever opens with a pin that
// was confirmed on the map (and passed the duplicate check there). Anything
// arriving without valid ?lat&long — nav links, bookmarks, malformed deep
// links — is sent to placement mode instead. Universal load, so SSR and
// client-side navigations redirect alike.
export const load: PageLoad = ({ url }) => {
	const coords = parseCoordsParams(url.searchParams);
	if (!coords) redirect(302, "/map?add=redirect");
	return { coords };
};
