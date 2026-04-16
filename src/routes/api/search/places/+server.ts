import { error } from "@sveltejs/kit";

import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, fetch }) => {
	const query = url.searchParams.get("name");

	if (!query || query.trim().length === 0) {
		error(400, "Missing required parameter: name");
	}

	const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);

	let res: Response;
	try {
		res = await fetch(
			`https://api.btcmap.org/v4/places/search/?name=${encodeURIComponent(query)}&fields=${fields}`,
		);
	} catch (err) {
		console.error("Search API error:", err);
		error(502, "Search temporarily unavailable");
	}

	if (!res.ok) {
		console.error("Search API error:", await res.text());
		error(res.status, "Search temporarily unavailable");
	}

	return new Response(JSON.stringify(await res.json()), {
		headers: { "Content-Type": "application/json" },
	});
};
