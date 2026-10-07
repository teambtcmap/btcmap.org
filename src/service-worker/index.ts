import { version } from "$app/env";
import { assets, immutable } from "$app/manifest";
import { asset } from "$app/paths";
import { self as sw } from "$app/service-worker";
import type { AssetPath } from "$app/types";

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// Manifest paths are base-relative; the fetch handler matches absolute
// pathnames. `immutable` is typed as plain strings, asset() accepts them.
const ASSETS: string[] = [
	...immutable.map(({ path }) => asset(path as AssetPath)), // the app itself
	...assets.map(({ path }) => asset(path)), // everything in `static`
];

sw.addEventListener("install", (event) => {
	// Create a new cache and add offline file to it
	async function addFileToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(["/offline.html", "/images/logo.svg"]);
	}

	event.waitUntil(addFileToCache());
});

sw.addEventListener("activate", (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

sw.addEventListener("message", (event) => {
	async function cacheAssets() {
		// Create a new cache and add all files to it
		const cache = await caches.open(CACHE);
		const cached = await cache.match("/cached.txt");

		if (cached) return;

		await cache.addAll(ASSETS);
	}

	if (event.data === "CACHE_ASSETS") {
		event.waitUntil(cacheAssets());
	}
});

sw.addEventListener("fetch", (event) => {
	// ignore POST requests etc
	if (event.request.method !== "GET") return;

	// ignore requests from chrome-extension etc
	if (event.request.url.indexOf("http") === -1) return;

	const url = new URL(event.request.url);

	// Never intercept API/data requests — they must reach the network and
	// return real JSON or a real error. Serving a cached response or the
	// offline.html fallback hands the app HTML where it expects JSON, which
	// corrupts parsing (e.g. the boost flow's merchant lookup ends up with an
	// invalid id and the drawer silently resets), and caching volatile
	// endpoints like invoice status returns stale results.
	if (
		url.hostname === "api.btcmap.org" ||
		// Third-party geodata lookup (add-location address suggestion):
		// network-only — a cached or offline-faked address is worse than none.
		url.hostname === "nominatim.openstreetmap.org" ||
		url.pathname.startsWith("/api/") ||
		url.pathname.startsWith("/btcmap-api-proxy") ||
		url.pathname.startsWith("/rpc")
	) {
		return;
	}

	async function respond() {
		const cache = await caches.open(CACHE);

		// Don't cache external map tile/style/sprite resources to prevent stale map data
		// Map styles and sprites can change, and caching them causes issues like missing icons
		// Exception: fonts are stable and benefit from caching for repeat visitors
		const isFontResource =
			url.hostname === "tiles.openfreemap.org" &&
			url.pathname.includes("/fonts/");
		const isMapResource =
			(url.hostname === "tiles.openfreemap.org" && !isFontResource) ||
			(url.hostname === "static.btcmap.org" &&
				url.pathname.includes("map-styles"));

		// `immutable`/`assets` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const res = await cache.match(url.pathname);
			if (res) return res;
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			// Only cache non-map resources to avoid serving stale map styles/sprites.
			// Redirected responses (e.g. /add-location → /map?add=) are skipped:
			// Cache.put rejects them, and caching the target under the original
			// URL would serve the wrong page offline.
			if (response.status === 200 && !response.redirected && !isMapResource) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const cachedPage = await cache.match(event.request);

			if (cachedPage && cachedPage.status === 200) {
				return cachedPage;
			} else {
				// Response.error() is what respondWith(undefined) amounted to before
				return (await cache.match("/offline.html")) ?? Response.error();
			}
		}
	}

	event.respondWith(respond());
});
