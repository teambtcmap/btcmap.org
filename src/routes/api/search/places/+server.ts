import { error } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";
import type { SearchResponse } from "$types/btcmap-api/SearchResponse";

// Worldwide free-text search. Backed by /v4/search, which matches every OSM tag
// value, so a city name finds the places addressed in that city. Scoped to
// places: the results panel renders a Place[] and cannot display areas.
export const GET: RequestHandler = async ({ url, fetch }) => {
	const query = url.searchParams.get("name");

	if (!query || query.trim().length === 0) {
		error(400, "Missing required parameter: name");
	}

	const params = new URLSearchParams({
		q: query,
		type_filter: "place",
		limit: "100",
	});

	// Both or neither: the API rejects a lone coordinate. Supplying them lets the
	// server break relevance ties by proximity, which is what makes `limit`
	// meaningful for a query like "hamburg" that no place is actually named.
	const lat = url.searchParams.get("lat");
	const lon = url.searchParams.get("lon");
	if (lat && lon) {
		params.set("lat", lat);
		params.set("lon", lon);
	}

	let res: Response;
	try {
		res = await fetch(`${API_BASE}/v4/search/?${params}`);
	} catch (err) {
		console.error("Search API error:", err);
		error(502, "Search temporarily unavailable");
	}

	if (!res.ok) {
		console.error("Search API error:", await res.text());
		error(res.status, "Search temporarily unavailable");
	}

	// Partial: the type describes what the current API sends, but this proxy
	// deliberately tolerates an upstream that omits fields (see tests).
	const body = (await res.json()) as Partial<SearchResponse>;
	// Drop the discriminator; `type_filter=place` means every row is a place
	// at runtime, though the static type stays the area/place union.
	const places = (body.results ?? []).map(({ type: _type, ...place }) => place);

	// The API caps `limit`, so a broad query ("str" matches every addr:street)
	// returns far fewer rows than it matched. Pass the true total through instead
	// of letting the panel present a truncated slice as the whole result set.
	return new Response(
		JSON.stringify({
			places,
			total: body.total_count ?? places.length,
			hasMore: body.has_more ?? false,
		}),
		{ headers: { "Content-Type": "application/json" } },
	);
};
