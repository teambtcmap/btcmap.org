import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const geoHeader = request.headers.get('x-nf-geo');

	// DEBUG: Log all headers
	const allHeaders: Record<string, string> = {};
	request.headers.forEach((value, key) => {
		allHeaders[key] = value;
	});
	console.log('=== PAGE SERVER DEBUG ===');
	console.log('x-nf-geo header:', geoHeader);
	console.log('All headers:', JSON.stringify(allHeaders, null, 2));

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

	// DEBUG: Return debug info to client
	return {
		geo,
		_debug: {
			geoHeader,
			headersReceived: Object.keys(allHeaders)
		}
	};
};
