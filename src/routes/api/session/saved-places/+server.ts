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

// POST /api/session/saved-places
// Proxies POST /v4/places/saved (body: single integer) to avoid browser
// CORS preflight issues. Returns the updated saved-place IDs.
export const POST: RequestHandler = async ({ request, fetch }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const id = await request.json();
	if (!Number.isInteger(id)) {
		error(400, "Body must be an integer place ID");
	}

	let res: Response;
	try {
		res = await fetch(`${API_BASE}/v4/places/saved`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(id),
		});
	} catch (err) {
		console.error("Failed to add saved place:", err);
		error(502, "Failed to add saved place");
	}

	if (!res.ok) {
		console.error("Failed to add saved place:", await res.text());
		error(res.status, "Failed to add saved place");
	}

	return json(await res.json());
};
