import { latCalc, longCalc } from '$lib/map/setup';
import type { Element } from '$lib/types';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export interface VerifyLocationPageData {
	id: string;
	name: string | undefined;
	lat: number;
	long: number;
	location: string;
	edit: string;
	merchantId: string;
}

export const load: PageServerLoad<VerifyLocationPageData> = async ({ url }) => {
	const id = url.searchParams.get('id');

	if (!id) {
		error(400, 'Merchant ID parameter is required');
	}

	try {
		// Use v2 Elements API to fetch merchant data
		const response = await axios.get(`https://api.btcmap.org/v2/elements/${id}`);

		const data: Element = response.data;
		const lat = latCalc(data.osm_json);
		const long = longCalc(data.osm_json);

		if (data && data.id && lat && long && !data['deleted_at']) {
			const name = data.osm_json.tags?.name;
			const location = `https://btcmap.org/map?lat=${lat}&long=${long}`;
			const edit = `https://www.openstreetmap.org/edit?${data.osm_json.type}=${data.osm_json.id}`;
			const merchantId = `${data.osm_json.type}:${data.osm_json.id}`;

			return {
				id: data.id,
				name,
				lat,
				long,
				location,
				edit,
				merchantId
			};
		}
		error(404, 'Merchant Not Found');
	} catch (err) {
		console.error(err);
		error(404, 'Merchant Not Found');
	}
};
