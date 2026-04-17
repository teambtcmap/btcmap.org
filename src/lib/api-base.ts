// Resolved API base URL. Defaults to the production endpoint; override via
// VITE_API_BASE_URL in .env for local development (e.g. "/btcmap-api-proxy"
// to route through the Vite dev proxy, or "http://127.0.0.1:8000" directly).
//
// On the server (SSR), relative paths like "/btcmap-api-proxy" can't be used
// with Node's global fetch or axios — there's no browser origin to resolve
// against. SvelteKit's event.fetch handles this for +page.server.ts load
// functions, but other server-side callers (axios, global fetch in +server.ts)
// need an absolute URL. We resolve relative paths against the dev server
// origin so the Vite proxy still works during SSR.
function resolveApiBase(): string {
	const raw = (
		import.meta.env.VITE_API_BASE_URL || "https://api.btcmap.org"
	).replace(/\/+$/, "");
	if (typeof window === "undefined" && raw.startsWith("/")) {
		const port = import.meta.env.VITE_PORT || 5000;
		return `http://localhost:${port}${raw}`;
	}
	return raw;
}

export const API_BASE: string = resolveApiBase();
