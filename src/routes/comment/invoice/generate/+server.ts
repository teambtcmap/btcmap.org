import { error } from "@sveltejs/kit";
import axios from "axios";
import axiosRetry from "axios-retry";

import type { RequestHandler } from "./$types";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const { place_id, comment } = data;

	if (!place_id || !comment) {
		error(400, "Missing required parameters: place_id and comment");
	}

	const response = await axios
		.post("https://api.btcmap.org/v4/place-comments", {
			place_id,
			comment,
		})
		.then((response) => response.data)
		.catch((err) => {
			console.error(err);
			error(
				400,
				"Could not process comment request, please try again or contact BTC Map.",
			);
		});

	return new Response(JSON.stringify(response));
};
