import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3 });

export async function load({ params }) {
	let { id } = params;
	try {
		const response = await axios.get(`https://api.btcmap.org/v2/elements/${id}`);

		const data = response.data;

		if (data && data.id) {
			return {
				id: data.id,
				name: data.osm_json.tags && data.osm_json.tags.name ? data.osm_json.tags.name : ''
			};
		}
	} catch (err) {
		throw error(404, 'Merchant Not Found');
	}
}
