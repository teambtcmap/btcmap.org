import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";

// GET /api/session/saved-places
// Proxies GET /v4/places/saved to avoid browser CORS preflight issues.
export const GET: RequestHandler = async ({ request, fetch }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	let res: Response;
	try {
		res = await fetch(`${API_BASE}/v4/places/saved`, {
			headers: { Authorization: token },
		});
	} catch (err) {
		console.error("Failed to fetch saved places:", err);
		error(502, "Failed to fetch saved places");
	}

	if (!res.ok) {
		console.error("Failed to fetch saved places:", await res.text());
		error(res.status, "Failed to fetch saved places");
	}

	return json(await res.json());
};

// PUT /api/session/saved-places
// Proxies PUT /v4/places/saved to avoid browser CORS preflight issues.
export const PUT: RequestHandler = async ({ request, fetch }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const ids = await request.json();
	if (!Array.isArray(ids)) {
		error(400, "Body must be a JSON array of place IDs");
	}

	let res: Response;
	try {
		res = await fetch(`${API_BASE}/v4/places/saved`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(ids),
		});
	} catch (err) {
		console.error("Failed to save places:", err);
		error(502, "Failed to save places");
	}

	if (!res.ok) {
		console.error("Failed to save places:", await res.text());
		error(res.status, "Failed to save places");
	}

	return json(await res.json());
};
