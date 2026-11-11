import { resolve } from "$app/paths";

// The /verify-location link for a place: its load reads `?id=`, a numeric
// or OSM-style (type:id) place id. Kept out of verification.ts so the
// modules importing that don't pull in $app/paths.
export const verifyLocationHref = (id: string): string =>
	`${resolve("/verify-location")}?id=${encodeURIComponent(id)}`;
