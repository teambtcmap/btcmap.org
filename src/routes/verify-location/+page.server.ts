import { error } from '@sveltejs/kit';
import axios from 'axios';
import type { PageServerLoad } from './$types';
import { isValidPlaceId } from '$lib/utils';

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

	// Validate id parameter format (numeric or OSM-style type:id)
	if (!isValidPlaceId(id)) {
		error(404, 'Merchant Not Found');
	}

	try {
		// Fetch from v4 Places API (supports both numeric Place IDs and OSM-style IDs)
		const response = await axios.get(
			`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}?fields=id,osm_id,osm_url,name,address,lat,lon`
		);
		const placeData = response.data;

		if (!placeData) {
			error(404, 'Merchant Not Found');
		}

		// Extract OSM type and ID from osm_url
		let osmType = 'node';
		let osmId = id; // fallback

		if (placeData.osm_url) {
			const osmMatch = placeData.osm_url.match(/openstreetmap\.org\/([^/]+)\/(\d+)/);
			if (osmMatch) {
				osmType = osmMatch[1];
				osmId = osmMatch[2];
			}
		} else if (placeData.osm_id) {
			// Fallback to parsing osm_id string
			const parts = placeData.osm_id.split(':');
			if (parts.length === 2) {
				osmType = parts[0];
				osmId = parts[1];
			}
		}

		const location = `https://btcmap.org/map#18/${placeData.lat}/${placeData.lon}`;
		const edit = `https://www.openstreetmap.org/edit?${osmType}=${osmId}`;
		const merchantId = placeData.id.toString();

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
