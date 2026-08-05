// MapLibre v6 no longer embeds its web worker in the main bundle — apps
// built with a bundler must register the worker URL before the first Map
// is constructed, or every map renders as a silent blank with no error
// event and no console message. The failure is production-only: `vite dev`
// serves module dependencies individually, so the worker resolves there
// even without registration. See the v5→v6 migration guide.
//
// The `?worker&url` suffix (NOT plain `?url`) makes Vite emit the worker
// as a real built chunk with its `maplibre-gl-shared.mjs` sibling import
// rewritten. Plain `?url` copies the file verbatim, which also passes dev
// and then 404s the sibling import only in production builds.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Idempotent for the same reason as ensureRtlTextPlugin: several
// components initialise their own map and client-side navigation can
// re-run onMount. setWorkerUrl is a plain module-global setter, so
// repeat calls are harmless — the guard just keeps intent obvious.
let registered = false;

export const ensureMapLibreWorkerUrl = (
	maplibre: typeof import("maplibre-gl"),
): void => {
	if (registered) return;
	registered = true;
	maplibre.setWorkerUrl(workerUrl);
};
