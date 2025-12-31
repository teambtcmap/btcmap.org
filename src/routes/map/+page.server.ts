import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const geo: { lat: number | null; lng: number | null } = { lat: null, lng: null };

	// Netlify Edge provides geo on platform.context.geo
	const netlifyGeo = platform?.context?.geo;
	if (typeof netlifyGeo?.latitude === 'number' && typeof netlifyGeo?.longitude === 'number') {
		geo.lat = netlifyGeo.latitude;
		geo.lng = netlifyGeo.longitude;
	}

	return { geo };
};
