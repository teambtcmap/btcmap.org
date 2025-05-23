import { BTCMAP_KEY } from '$env/static/private';
import { error, json } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const used: string[] = [];

export const POST: RequestHandler = async ({ request }) => {
	const { element, time, hash } = await request.json();

	// check that time is valid
	const validTimes = [1, 3, 12];
	if (!validTimes.includes(time)) {
		error(418);
	}

	// verify that the invoice has been paid
	if (used.includes(hash)) {
		error(418);
	}

	const boost = await axios
		.get(`https://btcmap.org/boost/invoice/status?hash=${hash}`)
		.then(function (response) {
			if (response.data.paid === true) {
				used.push(hash);
				return axios
					.post(`https://api.btcmap.org/rpc`, {
						jsonrpc: '2.0',
						method: 'boost_element',
						params: { password: BTCMAP_KEY, id: element, days: time * 30 },
						id: 1
					})
					.then(function (response) {
						return response.status;
					})
					.catch(function (err) {
						console.error(err);
						error(400, 'Could not finalize boost, please contact BTC Map.');
					});
			} else {
				return;
			}
		})
		.catch(function (err) {
			console.error(err);
			error(400, 'Could not finalize boost, please contact BTC Map.');
		});

	return json({ status: boost });
};
