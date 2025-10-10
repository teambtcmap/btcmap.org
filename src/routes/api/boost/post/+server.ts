import { error, json } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const used: string[] = [];

export const POST: RequestHandler = async ({ request }) => {
	const { invoice_id } = await request.json();

	// check that invoice_id is provided
	if (!invoice_id) {
		error(400, 'Missing required parameter: invoice_id');
	}

	// verify that the invoice has been paid
	if (used.includes(invoice_id)) {
		error(418, 'Invoice already processed');
	}

	const invoiceStatus = await axios
		.get(`https://api.btcmap.org/v4/invoices/${invoice_id}`)
		.then(function (response) {
			return response.data;
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not verify invoice status, please try again or contact BTC Map.');
		});

	if (invoiceStatus.status !== 'paid') {
		error(400, 'Invoice not paid');
	}

	used.push(invoice_id);

	return json({ status: 200 });
};
