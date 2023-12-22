import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// @ts-expect-error
export async function load({ params }) {
	const { id } = params;
	try {
		const response = await axios.get(`https://api.btcmap.org/v2/elements/${id}`);

		const data = response.data;

		if (data && data.id) {
			return {
				id: data.id,
				name: data.osm_json.tags?.name
			};
		}
	} catch (err) {
		error(404, 'Merchant Not Found');
	}
}
