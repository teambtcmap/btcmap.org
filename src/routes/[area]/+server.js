import { redirect, error } from '@sveltejs/kit';
import axios from 'axios';

export async function GET({ params }) {
	let { area } = params;

	const response = await axios.get('https://api.btcmap.org/areas');

	response.data.forEach((record) => {
		if (record.id === area) {
			throw redirect(
				302,
				`/map?lat=${record['min_lat']}&long=${record['min_lon']}&lat=${record['max_lat']}&long=${record['max_lon']}`
			);
		}
	});

	throw error(404, 'Not Found');
}
