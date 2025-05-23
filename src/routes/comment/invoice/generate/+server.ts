import { LNBITS_API_KEY, LNBITS_URL } from '$env/static/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const GET: RequestHandler = async ({ url }) => {
	const amount = url.searchParams.get('amount');
	const name = url.searchParams.get('name');

	const headers = {
		'X-API-Key': `${LNBITS_API_KEY}`,
		'Content-type': 'application/json'
	};

	const invoice = await axios
		.post(
			`https://${LNBITS_URL}/api/v1/payments`,
			{
				out: false,
				amount: `${amount}`,
				memo: `BTC Map coment for: ${name}`,
				unit: 'sat'
			},
			{ headers }
		)
		.then(function (response) {
			return response.data;
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not generate invoice, please try again or contact BTC Map.');
		});

	return new Response(JSON.stringify(invoice));
};
