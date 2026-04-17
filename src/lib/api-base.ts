// Resolved API base URL. Defaults to the production endpoint; override via
// VITE_API_BASE_URL in .env for local development.
//
// Client-side: relative paths like "/btcmap-api-proxy" work fine — the
// browser resolves them against the current origin, hitting the Vite dev
// proxy. SvelteKit's event.fetch in +page.server.ts load functions also
// handles relative URLs.
//
// Server-side (axios in +server.ts, module-level SSR code): relative paths
// fail because Node has no browser origin. For these callers, set an
// absolute URL instead (e.g. "http://127.0.0.1:8000").
export const API_BASE: string = (
	import.meta.env.VITE_API_BASE_URL || "https://api.btcmap.org"
).replace(/\/+$/, "");
