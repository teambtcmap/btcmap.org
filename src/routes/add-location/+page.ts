import { redirect } from "@sveltejs/kit";

import {
	buildAddFormUrl,
	parseCoordsParams,
	placementEntryUrl,
} from "$lib/placementMode";

import type { PageLoad } from "./$types";

// The standalone page is retired (#1134): the form lives on the map now.
// This route survives only as a courtesy to old deep links. Valid
// ?lat&long — years of shared "add a place" URLs — opens the in-map form
// at that pin; anything else goes to placement mode, as the guard always
// did. Universal load, so SSR and client-side navigations redirect alike.
export const load: PageLoad = ({ url }) => {
	const coords = parseCoordsParams(url.searchParams);
	if (!coords) redirect(302, placementEntryUrl("redirect"));
	redirect(302, buildAddFormUrl(coords.lat, coords.long));
};
