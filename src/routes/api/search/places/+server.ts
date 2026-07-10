import { error } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";

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

	const body = (await res.json()) as {
		results?: ({ type: string } & Record<string, unknown>)[];
	};
	// Drop the discriminator so the response stays exactly Place[], the shape the
	// map route and merchantListStore already consume.
	const places = (body.results ?? []).map(({ type: _type, ...place }) => place);

	return new Response(JSON.stringify(places), {
		headers: { "Content-Type": "application/json" },
	});
};
