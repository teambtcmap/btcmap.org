import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const { element_id, comment } = data;

	if (!element_id || !comment) {
		error(400, 'Missing required parameters: element_id and comment');
	}

	const response = await axios
		.post('https://api.btcmap.org/rpc', {
			jsonrpc: '2.0',
			method: 'paywall_add_element_comment',
			params: {
				element_id,
				comment
			},
			id: 1
		})
		.then(function (response) {
			return response.data.result;
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not process comment request, please try again or contact BTC Map.');
		});

	return new Response(JSON.stringify(response));
};
