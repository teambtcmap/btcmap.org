import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const GET: RequestHandler = async ({ url }) => {
	const hash = url.searchParams.get('hash');

	if (!hash) {
		error(400, 'Missing required parameter: hash');
	}

	const status = await axios
		.post('https://api.btcmap.org/rpc', {
			jsonrpc: '2.0',
			method: 'get_invoice',
			params: {
				invoice_id: hash
			},
			id: 1
		})
		.then(function (response) {
			return response.data.result;
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not check invoice status, please try again or contact BTC Map.');
		});

	return new Response(JSON.stringify(status));
};
