import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { RequestHandler } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('name');

	if (!query || query.trim().length === 0) {
		error(400, 'Missing required parameter: name');
	}

	try {
		const response = await axios.get(
			`https://api.btcmap.org/v4/places/search/?name=${encodeURIComponent(query)}`
		);

		return new Response(JSON.stringify(response.data), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Search API error:', err);
		error(500, 'Search temporarily unavailable');
	}
};
