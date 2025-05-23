import { BTCMAP_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const GET: RequestHandler = async ({ url }) => {
	const amount = url.searchParams.get('amount');
	const name = url.searchParams.get('name');

	if (!amount || !name) {
		error(400, 'Missing required parameters: amount and name');
	}

	console.log(`BTCMAP_KEY: ${BTCMAP_KEY}`);

	const invoice = await axios
		.post('https://api.btcmap.org/rpc', {
			jsonrpc: '2.0',
			method: 'generate_invoice',
			params: {
				password: BTCMAP_KEY,
				amount_sats: parseInt(amount),
				description: `BTC Map comment for: ${name}`,
				entity_type: 'comment',
				entity_id: name
			},
			id: 1
		})
		.then(function (response) {
			return response.data.result;
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not generate invoice, please try again or contact BTC Map.');
		});

	return new Response(JSON.stringify(invoice));
};
