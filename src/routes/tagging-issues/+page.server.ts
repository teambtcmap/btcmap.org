import { API_BASE } from "$lib/api-base";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch(
			`${API_BASE}/v4/place-issues?area_id=662&limit=10000&offset=0`,
		);

		if (!response.ok) {
			return {
				error: `HTTP Error: ${response.status}`,
				rpcResult: null,
			};
		}

		const data = await response.json();

		return {
			result: data,
		};
	} catch (err) {
		return {
			error:
				err instanceof Error ? err.message : "Failed to load element issues",
			rpcResult: null,
		};
	}
};
