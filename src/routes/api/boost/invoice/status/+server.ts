import { error } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

// check the status of an invoice
export const GET: RequestHandler = async ({ url, fetch }) => {
	const invoiceId = url.searchParams.get("invoice_id");

	if (!invoiceId) {
		error(400, "Missing required parameter: invoice_id");
	}

	let res: Response;
	try {
		res = await fetch(
			`https://api.btcmap.org/v4/invoices/${encodeURIComponent(invoiceId)}`,
		);
	} catch (err) {
		console.error("Failed to check invoice status:", err);
		error(
			502,
			"Could not check invoice status, please try again or contact BTC Map.",
		);
	}

	if (!res.ok) {
		console.error("Failed to check invoice status:", await res.text());
		error(
			res.status,
			"Could not check invoice status, please try again or contact BTC Map.",
		);
	}

	return new Response(JSON.stringify(await res.json()));
};
