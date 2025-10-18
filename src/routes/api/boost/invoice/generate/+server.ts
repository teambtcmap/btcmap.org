import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

interface BoostInvoiceRequest {
	place_id: number;
	amount: number;
	time: number;
	name: string;
}

// generate and return invoice
export const POST: RequestHandler = async ({ request }) => {
	const data: BoostInvoiceRequest = await request.json();
	const { place_id, amount, time, name } = data;

	if (!place_id || !amount || !time || !name) {
		error(400, 'Missing required parameters: place_id, amount, time, name');
	}

	if (amount <= 0 || time <= 0) {
		error(400, 'Invalid numeric parameters: amount and time must be positive integers');
	}

	const invoice = await axios
		.post('https://api.btcmap.org/v4/place-boosts', {
			place_id: place_id,
			sats_amount: amount,
			days: time
		})
		.then(function (response) {
			return response.data;
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not generate boost invoice, please try again or contact BTC Map.');
		});

	return new Response(JSON.stringify(invoice));
};
