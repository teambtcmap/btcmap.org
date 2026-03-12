import { error } from "@sveltejs/kit";

import api from "$lib/axios";

import type { RequestHandler } from "./$types";

// check the status of an invoice
export const GET: RequestHandler = async ({ url }) => {
	const invoiceId = url.searchParams.get("invoice_id");

	if (!invoiceId) {
		error(400, "Missing required parameter: invoice_id");
	}

	const status = await api
		.get(`https://api.btcmap.org/v4/invoices/${invoiceId}`)
		.then((response) => response.data)
		.catch((err) => {
			console.error(err);
			error(
				400,
				"Could not check invoice status, please try again or contact BTC Map.",
			);
		});

	return new Response(JSON.stringify(status));
};
