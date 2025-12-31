import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
	// DEBUG: Log what we receive
	console.log('=== EDGE FUNCTION DEBUG ===');
	console.log('context.geo:', JSON.stringify(context.geo));
	console.log('request.url:', request.url);

	// Add geo data as a header to the request before passing to SvelteKit
	const geo = context.geo;

	if (geo?.latitude != null && geo?.longitude != null) {
		const newRequest = new Request(request.url, {
			method: request.method,
			headers: new Headers(request.headers),
			body: request.body,
			redirect: request.redirect
		});
		const geoJson = JSON.stringify(geo);
		newRequest.headers.set('x-nf-geo', geoJson);
		console.log('Injected x-nf-geo header:', geoJson);

		return context.next(newRequest);
	}

	console.log('No geo data available, passing through');
	return context.next();
};

export const config = {
	path: '/map'
};
