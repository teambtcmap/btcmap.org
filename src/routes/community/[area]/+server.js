import { redirect, error } from '@sveltejs/kit';
import axios from 'axios';

export async function GET({ params }) {
	let { area } = params;

	const response = await axios.get(`https://api.btcmap.org/v2/areas/${area}`);

	const data = response.data;

	if (data) {
		throw redirect(
			302,
			`/map?lat=${data.tags['box:south']}&long=${data.tags['box:west']}&lat=${data.tags['box:north']}&long=${data.tags['box:east']}`
		);
	}

	throw error(404, 'Not Found');
}
