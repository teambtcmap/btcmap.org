import { addEntryMethod } from "$lib/placementMode";

import type { PageLoad } from "./$types";

// Captured per navigation, before any component mounts: AddPlaceMode's URL
// effect rewrites ?add=<entry> to a bare ?add= as soon as it mounts, so
// reading the value from window.location in the page would silently
// depend on mount order. The load runs first by construction. The server
// load's data (IP geo, OG image) is forwarded untouched.
export const load: PageLoad = ({ url, data }) => ({
	...data,
	addEntryMethod: addEntryMethod(url.searchParams.get("add")),
});
