import axios from 'axios';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	let { id } = params;

	const response = await axios.get(`https://api.btcmap.org/v2/users/${id}`);

	const data = response.data;

	if (data) {
		return { user: data.id };
	}

	throw error(404, 'User Not Found');
}
