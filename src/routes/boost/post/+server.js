import axios from 'axios';
import { BTCMAP_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';

let used = [];

export async function POST({ request }) {
	const headers = {
		Authorization: `Bearer ${BTCMAP_KEY}`
	};

	let { element, time, hash } = await request.json();

	// check that time is valid
	const validTimes = [1, 3, 12];
	if (!validTimes.includes(time)) {
		return;
	}

	// verify that the invoice has been paid
	if (used.includes(hash)) {
		return;
	}

	let boost = await axios
		.get(`http://localhost:5173/boost/invoice/status?hash=${hash}`)
		.then(function (response) {
			if (response.data.paid === true) {
				used.push(hash);

				axios
					.get(`https://api.btcmap.org/v2/elements/${element}`)
					.then(function (response) {
						let expires;

						if (response.data.tags && response.data.tags['boost:expires']) {
							let currentBoost = new Date(response.data.tags['boost:expires']);
							expires = new Date(currentBoost.setMonth(currentBoost.getMonth() + time));
						} else {
							let dateNow = new Date();
							expires = new Date(dateNow.setMonth(dateNow.getMonth() + time));
						}

						axios
							.post(
								`https://api.btcmap.org/v2/elements/${element}/tags`,
								`name=boost:expires&value=${expires.toISOString()}`,
								{ headers }
							)
							.then(function (response) {
								return 'Boost success!';
							})
							.catch(function (error) {
								throw error(400, 'Could not finalize boost, please contact BTC Map.');
								console.log(error);
							});
					})
					.catch(function (error) {
						throw error(400, 'Could not finalize boost, please contact BTC Map.');
						console.log(error);
					});
			} else {
				return;
			}
		})
		.catch(function (error) {
			throw error(400, 'Could not finalize boost, please contact BTC Map.');
			console.log(error);
		});

	return new Response(String(boost));
}
