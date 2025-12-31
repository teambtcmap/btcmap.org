import type { PageServerLoad } from './$types';
import type { GeoLocation } from '$lib/types';

export const load: PageServerLoad = async ({ request }) => {
	const geoHeader = request.headers.get('x-nf-geo');

	const geo: GeoLocation = { lat: null, lng: null };

	if (geoHeader) {
		try {
			// Netlify encodes the geo header as base64
			const decoded = Buffer.from(geoHeader, 'base64').toString('utf-8');
			const geoData = JSON.parse(decoded);
			if (typeof geoData.latitude === 'number' && typeof geoData.longitude === 'number') {
				geo.lat = geoData.latitude;
				geo.lng = geoData.longitude;
			}
		} catch {
			// Silently fail - will use default
		}
	}

	return { geo };
};
