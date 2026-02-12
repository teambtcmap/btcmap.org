import { error } from "@sveltejs/kit";
import axios from "axios";
import axiosRetry from "axios-retry";

import type { RequestHandler } from "./$types";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

interface BoostInvoiceRequest {
	place_id: number;
	days: number;
}

// generate and return invoice
export const POST: RequestHandler = async ({ request }) => {
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

	const invoice = await axios
		.post("https://api.btcmap.org/v4/place-boosts", {
			place_id: place_id.toString(),
			days: days,
		})
		.then((response) => response.data)
		.catch((err) => {
			console.error(err);
			error(
				400,
				"Could not generate boost invoice, please try again or contact BTC Map.",
			);
		});

	return new Response(JSON.stringify(invoice));
};
