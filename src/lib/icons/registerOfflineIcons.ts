import { addCollection } from "@iconify/svelte/dist/functions";

import { iconCollections } from "$lib/icons/bundle";

// Preload the app's known icon vocabulary into @iconify/svelte's in-memory
// store so <Icon> renders without calling api.iconify.design.
//
// This is additive and purely a resilience measure: any icon not in the bundle
// still loads from the live API exactly as before (the batched ic.json endpoint
// UI icons use is not the rate-limited surface — the per-glyph .svg route is).
// Imported for its side effect from the root layout so it runs before any Icon
// component mounts.
for (const collection of Object.values(iconCollections)) {
	addCollection(collection);
}
