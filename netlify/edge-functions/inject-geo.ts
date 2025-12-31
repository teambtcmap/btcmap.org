import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
	// Add geo data as a header to the request before passing to SvelteKit
	const geo = context.geo;

	if (geo?.latitude != null && geo?.longitude != null) {
		const newRequest = new Request(request.url, {
			method: request.method,
			headers: new Headers(request.headers),
			body: request.body,
			redirect: request.redirect
		});
		newRequest.headers.set('x-nf-geo', JSON.stringify(geo));

		return context.next(newRequest);
	}

	return context.next();
};

export const config = {
	path: '/map'
};
