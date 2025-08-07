import { BTCMAP_KEY } from '$env/static/private';
import { error, json } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query');

	if (!query || query.length < 3) {
		return json({ results: [] });
	}

	if (!BTCMAP_KEY) {
		console.error('BTCMAP_KEY is not configured');
		return error(500, 'Search service not available');
	}

	try {
		const response = await axios.post('https://api.btcmap.org/rpc', {
			jsonrpc: '2.0',
			method: 'search',
			params: {
				password: BTCMAP_KEY,
				query: query.toLowerCase()
			},
			id: 1
		});

		const data = response.data;

		if (data.error) {
			console.error('BTC Map API error:', data.error);

			// Handle "Query returned no rows" as empty results, not an error
			if (data.error.data === 'Query returned no rows') {
				return json({ results: [] });
			}

			return error(500, 'Search service error');
		}

		// Filter results to only include places (not areas)
		// Based on the admin code, we need to filter by type
		const results = data.result || [];
		const places = results.filter((item: any) => {
			// Include items that don't have a type field (assuming these are places)
			// or explicitly have a place-like type
			return !item.type || item.type !== 'area';
		});

		return json({
			results: places.map((place: any) => ({
				id: place.id,
				name: place.name || 'Unnamed location',
				lat: place.lat || place.latitude,
				lon: place.lon || place.longitude,
				icon: place.icon || 'question_mark',
				address: place.address || '',
				boosted: place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false
			}))
		});
	} catch (err) {
		console.error('Search API error:', err);
		return error(500, 'Search service unavailable');
	}
};
