import { error, json } from "@sveltejs/kit";

import api from "$lib/axios";

import type { RequestHandler } from "./$types";

// GET /api/session/saved-places
// Proxies GET /v4/places/saved to avoid browser CORS preflight issues.
export const GET: RequestHandler = async ({ request }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const res = await api
		.get("https://api.btcmap.org/v4/places/saved", {
			headers: { Authorization: token },
		})
		.catch((err) => {
			const status = err?.response?.status ?? 502;
			console.error(
				"Failed to fetch saved places:",
				err?.response?.data ?? err,
			);
			error(status, "Failed to fetch saved places");
		});

	return json(res.data);
};

// PUT /api/session/saved-places
// Proxies PUT /v4/places/saved to avoid browser CORS preflight issues.
export const PUT: RequestHandler = async ({ request }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const ids = await request.json();
	if (!Array.isArray(ids)) {
		error(400, "Body must be a JSON array of place IDs");
	}

	const res = await api
		.put("https://api.btcmap.org/v4/places/saved", ids, {
			headers: { Authorization: token },
		})
		.catch((err) => {
			const status = err?.response?.status ?? 502;
			console.error("Failed to save places:", err?.response?.data ?? err);
			error(status, "Failed to save places");
		});

	return json(res.data);
};
