import type { HandleFetch } from "@sveltejs/kit";

// Fail-fast timeout for upstream API calls (10s).
const UPSTREAM_TIMEOUT_MS = 10_000;

// Set User-Agent and a fail-fast timeout on all server-side fetch calls
// to the upstream API.
export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	if (request.url.startsWith("https://api.btcmap.org")) {
		request.headers.set("User-Agent", "btcmap.org");
		return fetch(request, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
	}
	return fetch(request);
};
