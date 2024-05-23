import { latCalc, longCalc } from '$lib/map/setup';
import type { Element } from '$lib/types';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageLoad = async ({ params }) => {
	const { id } = params;
	try {
		const response = await axios.get(`https://api.btcmap.org/v2/elements/${id}`);

		const data: Element = response.data;
		const lat = latCalc(data.osm_json);
		const lon = longCalc(data.osm_json);

		if (data && data.id && lat && lon && !data['deleted_at']) {
			return {
				id: data.id,
				name: data.osm_json.tags?.name,
				lat,
				lon
			};
		}
	} catch (err) {
		error(404, 'Merchant Not Found');
	}
};
