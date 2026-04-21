import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";

// DELETE /api/session/saved-areas/{id}
// Proxies DELETE /v4/areas/saved/{id} to avoid browser CORS preflight
// issues. Returns the updated saved-area IDs.
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
		res = await fetch(`${API_BASE}/v4/areas/saved/${id}`, {
			method: "DELETE",
			headers: { Authorization: token },
		});
	} catch (err) {
		console.error("Failed to delete saved area:", err);
		error(502, "Failed to delete saved area");
	}

	if (!res.ok) {
		console.error("Failed to delete saved area:", await res.text());
		error(res.status, "Failed to delete saved area");
	}

	return json(await res.json());
};
