import { STADIA_API_KEY } from '$env/static/private';
import { MerchantOG } from '$lib/comp';
import { generateImage } from '../generateImage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const lat = url.searchParams.get('lat');
	const lon = url.searchParams.get('lon');

	if (!lat || !lon) return new Response(undefined, { status: 418 });

	const component = MerchantOG.render({ lat, lon, STADIA_API_KEY });

	const image = await generateImage(component);

	return new Response(image, {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'max-age=31449600'
		}
	});
};
