import { error } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, fetch }) => {
	const data = await request.json();
	const { place_id, comment } = data;

	if (!place_id || !comment) {
		error(400, "Missing required parameters: place_id and comment");
	}

	let res: Response;
	try {
		res = await fetch("https://api.btcmap.org/v4/place-comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ place_id, comment }),
		});
	} catch (err) {
		console.error("Failed to process comment request:", err);
		error(
			502,
			"Could not process comment request, please try again or contact BTC Map.",
		);
	}

	if (!res.ok) {
		console.error("Failed to process comment request:", await res.text());
		error(
			res.status,
			"Could not process comment request, please try again or contact BTC Map.",
		);
	}

	return new Response(JSON.stringify(await res.json()));
};
