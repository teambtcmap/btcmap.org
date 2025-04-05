import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageLoad = async ({ params }) => {
	const { id } = params;
	try {
		const response = await axios.get(`https://api.btcmap.org/v2/users/${id}`);

		const data = response.data;

		if (data) {
			return { user: data.id, username: data['osm_json']['display_name'] };
		}
	} catch (err) {
		console.error(err);
		error(404, 'User Not Found');
	}
};
