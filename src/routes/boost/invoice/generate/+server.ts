import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// generate and return invoice
export const GET: RequestHandler = async ({ url }) => {
	const amount = url.searchParams.get('amount');
	const name = url.searchParams.get('name');
	const time = url.searchParams.get('time');
	const placeId = url.searchParams.get('place_id');

	if (!amount || !name || !time || !placeId) {
		error(400, 'Missing required parameters: amount, name, time, place_id');
	}

	const invoice = await axios
		.post('https://api.btcmap.org/v4/place-boosts', {
			place_id: placeId,
			sats_amount: parseInt(amount),
			months: parseInt(time)
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
