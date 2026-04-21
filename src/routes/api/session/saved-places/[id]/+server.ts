import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";

// DELETE /api/session/saved-places/{id}
// Proxies DELETE /v4/places/saved/{id} to avoid browser CORS preflight
// issues. Returns the updated saved-place IDs.
export const DELETE: RequestHandler = async ({ params, request, fetch }) => {
	const token = request.headers.get("authorization");
	if (!token) {
		error(401, "Missing Authorization header");
	}

	const id = Number(params.id);
	if (!Number.isInteger(id)) {
		error(400, "Path param `id` must be an integer");
	}

	let res: Response;
	try {
		res = await fetch(`${API_BASE}/v4/places/saved/${id}`, {
			method: "DELETE",
			headers: { Authorization: token },
		});
	} catch (err) {
		console.error("Failed to delete saved place:", err);
		error(502, "Failed to delete saved place");
	}

	if (!res.ok) {
		console.error("Failed to delete saved place:", await res.text());
		error(res.status, "Failed to delete saved place");
	}

	return json(await res.json());
};
