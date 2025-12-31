import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const geoHeader = request.headers.get('x-nf-geo');

	const geo: { lat: number | null; lng: number | null } = { lat: null, lng: null };

	if (geoHeader) {
		try {
			const geoData = JSON.parse(geoHeader);
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
