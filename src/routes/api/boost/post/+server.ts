import { error, json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

const used: string[] = [];

export const POST: RequestHandler = async ({ request, fetch }) => {
	const { invoice_id } = await request.json();

	// check that invoice_id is provided
	if (!invoice_id) {
		error(400, "Missing required parameter: invoice_id");
	}

	// verify that the invoice has been paid
	if (used.includes(invoice_id)) {
		error(418, "Invoice already processed");
	}

	let res: Response;
	try {
		res = await fetch(
			`https://api.btcmap.org/v4/invoices/${encodeURIComponent(invoice_id)}`,
		);
	} catch (err) {
		console.error("Failed to verify invoice status:", err);
		error(
			502,
			"Could not verify invoice status, please try again or contact BTC Map.",
		);
	}

	if (!res.ok) {
		console.error("Failed to verify invoice status:", await res.text());
		error(
			res.status,
			"Could not verify invoice status, please try again or contact BTC Map.",
		);
	}

	const invoiceStatus = await res.json();

	if (invoiceStatus.status !== "paid") {
		error(400, "Invoice not paid");
	}

	used.push(invoice_id);

	return json({ status: 200 });
};
