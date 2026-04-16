import type { HandleFetch } from "@sveltejs/kit";

// Set User-Agent on all server-side fetch calls to the upstream API,
// matching the header previously set by the $lib/axios wrapper.
export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	if (request.url.startsWith("https://api.btcmap.org")) {
		request.headers.set("User-Agent", "btcmap.org");
	}
	return fetch(request);
};
