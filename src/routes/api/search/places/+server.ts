import { error } from "@sveltejs/kit";

import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
import api from "$lib/axios";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get("name");

	if (!query || query.trim().length === 0) {
		error(400, "Missing required parameter: name");
	}

	const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);

	try {
		const response = await api.get(
			`https://api.btcmap.org/v4/places/search/?name=${encodeURIComponent(query)}&fields=${fields}`,
		);

		return new Response(JSON.stringify(response.data), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (err) {
		console.error("Search API error:", err);
		error(500, "Search temporarily unavailable");
	}
};
