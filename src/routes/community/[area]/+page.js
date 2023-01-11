import axios from 'axios';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	let { area } = params;
	try {
		const response = await axios.get(`https://api.btcmap.org/v2/areas/${area}`);

		const data = response.data;

		if (data && data.id && data.tags && data.tags.name) {
			return { id: data.id, name: data.tags.name };
		}
	} catch (err) {
		throw error(404, 'Community Not Found');
	}
}
