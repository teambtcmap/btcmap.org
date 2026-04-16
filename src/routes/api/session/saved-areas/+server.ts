import { error, json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

// GET /api/session/saved-areas
// Proxies GET /v4/areas/saved to avoid browser CORS preflight issues.
export const GET: RequestHandler = async ({ request, fetch }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const res = await fetch("https://api.btcmap.org/v4/areas/saved", {
		headers: { Authorization: token },
	});

	if (!res.ok) {
		console.error("Failed to fetch saved areas:", await res.text());
		error(res.status, "Failed to fetch saved areas");
	}

	return json(await res.json());
};

// PUT /api/session/saved-areas
// Proxies PUT /v4/areas/saved to avoid browser CORS preflight issues.
export const PUT: RequestHandler = async ({ request, fetch }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const ids = await request.json();
	if (!Array.isArray(ids)) {
		error(400, "Body must be a JSON array of area IDs");
	}

	const res = await fetch("https://api.btcmap.org/v4/areas/saved", {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: token,
		},
		body: JSON.stringify(ids),
	});

	if (!res.ok) {
		console.error("Failed to save areas:", await res.text());
		error(res.status, "Failed to save areas");
	}

	return json(await res.json());
};
