import { error } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

type BoostInvoiceRequest = {
	place_id: number;
	days: number;
};

// generate and return invoice
export const POST: RequestHandler = async ({ request, fetch }) => {
	const data: BoostInvoiceRequest = await request.json();
	const { place_id, days } = data;

	if (!place_id || !days) {
		error(400, "Missing required parameters: place_id, days");
	}

	if (days <= 0) {
		error(
			400,
			"Invalid days parameter: must be a positive integer (30, 90, or 365)",
		);
	}

	let res: Response;
	try {
		res = await fetch("https://api.btcmap.org/v4/place-boosts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ place_id: place_id.toString(), days }),
		});
	} catch (err) {
		console.error("Failed to generate boost invoice:", err);
		error(
			502,
			"Could not generate boost invoice, please try again or contact BTC Map.",
		);
	}

	if (!res.ok) {
		console.error("Failed to generate boost invoice:", await res.text());
		error(
			res.status,
			"Could not generate boost invoice, please try again or contact BTC Map.",
		);
	}

	return new Response(JSON.stringify(await res.json()));
};
