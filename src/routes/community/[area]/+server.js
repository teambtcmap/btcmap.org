import { redirect, error } from '@sveltejs/kit';
import axios from 'axios';

export async function GET({ params }) {
	let { area } = params;

	const response = await axios.get(`https://api.btcmap.org/v2/areas/${area}`);

	const data = response.data;

	if (data) {
		throw redirect(
			302,
			`/map?lat=${data['min_lat']}&long=${data['min_lon']}&lat=${data['max_lat']}&long=${data['max_lon']}`
		);
	}

	throw error(404, 'Not Found');
}
