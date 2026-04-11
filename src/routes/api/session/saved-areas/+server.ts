import { error, json } from "@sveltejs/kit";

import api from "$lib/axios";

import type { RequestHandler } from "./$types";

// GET /api/session/saved-areas
// Proxies GET /v4/areas/saved to avoid browser CORS preflight issues.
export const GET: RequestHandler = async ({ request }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const res = await api
		.get("https://api.btcmap.org/v4/areas/saved", {
			headers: { Authorization: token },
		})
		.catch((err) => {
			const status = err?.response?.status ?? 502;
			console.error("Failed to fetch saved areas:", err?.response?.data ?? err);
			error(status, "Failed to fetch saved areas");
		});

	return json(res.data);
};

// PUT /api/session/saved-areas
// Proxies PUT /v4/areas/saved to avoid browser CORS preflight issues.
export const PUT: RequestHandler = async ({ request }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const ids = await request.json();
	if (!Array.isArray(ids)) {
		error(400, "Body must be a JSON array of area IDs");
	}

	const res = await api
		.put("https://api.btcmap.org/v4/areas/saved", ids, {
			headers: { Authorization: token },
		})
		.catch((err) => {
			const status = err?.response?.status ?? 502;
			console.error("Failed to save areas:", err?.response?.data ?? err);
			error(status, "Failed to save areas");
		});

	return json(res.data);
};
