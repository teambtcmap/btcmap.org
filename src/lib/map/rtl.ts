// MapLibre renders right-to-left scripts (Arabic, Hebrew, Persian) backwards
// unless the RTL text plugin is registered. Registration is a one-time global
// on the maplibre-gl module and applies to every map: it fixes both the
// base-map street/place labels (from the vector styles) and BTC Map's own
// labels. See issue #1116.
//
// @mapbox/mapbox-gl-rtl-text is a standalone worker script MapLibre fetches by
// URL (via importScripts) — the recommended usage is to pass a hosted URL to
// setRTLTextPlugin, NOT to bundle/import it. The package's `exports` field
// deliberately exposes only its ESM ICU source, not the prebuilt dist worker,
// so there is no clean bundler import (see upstream mapbox/mapbox-gl-rtl-text#16
// and #18). A pure-ESM distribution that WOULD allow a clean import is staged in
// mapbox/mapbox-gl-rtl-text#41, but it's blocked on GL JS work — once it lands,
// revisit this and drop the vendored copy in favour of a normal import.
//
// So we self-host the recommended way: a copy of the plugin's dist file is
// vendored at static/mapbox-gl-rtl-text.js and served same-origin (no
// third-party CDN). NOTE: pnpm does NOT keep that copy in sync — the
// @mapbox/mapbox-gl-rtl-text devDependency only pins the version. After bumping
// it, re-sync the vendored file manually: `pnpm run sync:rtl-plugin`.
const rtlTextPluginUrl = "/mapbox-gl-rtl-text.js";

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
