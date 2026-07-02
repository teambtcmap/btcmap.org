// MapLibre renders right-to-left scripts (Arabic, Hebrew, Persian) backwards
// unless the RTL text plugin is registered. Registration is a one-time global
// on the maplibre-gl module and applies to every map: it fixes both the
// base-map street/place labels (from the vector styles) and BTC Map's own
// labels. See issue #1116.
//
// The plugin is a standalone worker script MapLibre fetches by URL (not an ES
// module import), so we hand Vite the bundled asset URL via `?url`. This keeps
// it same-origin (no third-party CDN) while staying version-managed in
// package.json. We reach the prebuilt dist file by relative path because the
// package's `exports` map only exposes its ESM source (./src/index.js) and
// rejects a bare subpath import of dist/.
import rtlTextPluginUrl from "../../../node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js?url";

// Idempotent: several components initialise their own map, and client-side
// navigation can re-run onMount. getRTLTextPluginStatus() is "unavailable" only
// before the first registration (it flips synchronously inside setRTLTextPlugin
// to "deferred" when lazy), so repeat calls become safe no-ops.
export const ensureRtlTextPlugin = (
	maplibre: typeof import("maplibre-gl"),
): void => {
	if (maplibre.getRTLTextPluginStatus() !== "unavailable") return;
	// lazy=true → the ~148KB plugin is fetched only when the map first
	// encounters RTL text, so LTR-only users pay nothing. Failure degrades
	// gracefully (the map still renders; RTL text just stays unshaped).
	maplibre.setRTLTextPlugin(rtlTextPluginUrl, true).catch((err) => {
		console.error("Failed to load MapLibre RTL text plugin", err);
	});
};
