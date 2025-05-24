import { error, json } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const POST: RequestHandler = async ({ request }) => {
	const { element_id, content, user_id, payment_hash } = await request.json();

	if (!element_id || !content || !payment_hash) {
		error(400, 'Missing required parameters: element_id, content, and payment_hash');
	}

	const result = await axios
		.post('https://api.btcmap.org/rpc', {
			jsonrpc: '2.0',
			method: 'paywall_add_element_comment',
			params: {
				element_id,
				content,
				user_id: user_id || 'anonymous',
				payment_hash
			},
			id: 1
		})
		.then(function (response) {
			return response.data.result;
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not submit comment, please try again or contact BTC Map.');
		});

	return json(result);
};
