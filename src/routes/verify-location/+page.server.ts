import { latCalc, longCalc, checkAddress } from '$lib/map/setup';
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
		// Check if ID is numeric (Place ID) or OSM-style (node:123, way:123, etc.)
		const isNumericId = /^\d+$/.test(id);

		let placeData: {
			id: string;
			name?: string;
			address?: string;
			lat: number;
			lon: number;
			osm_url?: string;
		};
		let osmType = 'node';
		let osmId = id;

		if (isNumericId) {
			// For numeric Place IDs, fetch from v4 Places API
			const response = await axios.get(
				`https://api.btcmap.org/v4/places/${id}?fields=id,osm_id,osm_url,name,address,lat,lon`
			);
			placeData = response.data;

			if (!placeData) {
				error(404, 'Merchant Not Found');
			}

			// Extract OSM type and ID from osm_url if available
			if (placeData.osm_url) {
				const osmMatch = placeData.osm_url.match(/openstreetmap\.org\/([^/]+)\/(\d+)/);
				if (osmMatch) {
					osmType = osmMatch[1];
					osmId = osmMatch[2];
				}
			}
		} else {
			// For OSM-style IDs, use v2 Elements API as fallback
			const response = await axios.get(`https://api.btcmap.org/v2/elements/${id}`);
			const data: Element = response.data;

			if (!data || !data.id || data['deleted_at']) {
				error(404, 'Merchant Not Found');
			}

			placeData = {
				id: data.id,
				name: data.osm_json.tags?.name,
				address: data.osm_json.tags ? checkAddress(data.osm_json.tags) : undefined,
				lat: latCalc(data.osm_json),
				lon: longCalc(data.osm_json)
			};
			osmType = data.osm_json.type;
			osmId = data.osm_json.id.toString();
		}

		const location = `https://btcmap.org/map?lat=${placeData.lat}&long=${placeData.lon}`;
		const edit = `https://www.openstreetmap.org/edit?${osmType}=${osmId}`;
		const merchantId = isNumericId ? placeData.id.toString() : `${osmType}:${osmId}`;

		return {
			id: placeData.id.toString(),
			name: placeData.name,
			lat: placeData.lat,
			long: placeData.lon,
			location,
			edit,
			merchantId
		};
	} catch (err) {
		console.error(err);
		error(404, 'Merchant Not Found');
	}
};
