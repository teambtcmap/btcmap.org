import { error } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
	const { id } = params;

	// Validate id parameter format (numeric only)
	if (!/^\d+$/.test(id)) {
		error(404, "User Not Found");
	}

	try {
		const response = await api.get(
			`${API_BASE}/v2/users/${encodeURIComponent(id)}`,
		);

		const data = response.data;

		if (data) {
			return { user: data.id, username: data.osm_json.display_name };
		}
	} catch (err) {
		console.error(err);
		error(404, "User Not Found");
	}
};
