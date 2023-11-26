import { GITHUB_API_KEY, SERVER_CRYPTO_KEY, SERVER_INIT_VECTOR } from '$env/static/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';

axiosRetry(axios, { retries: 3 });

let used = [];

export async function POST({ request }) {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	let {
		captchaSecret,
		captchaTest,
		honey,
		location,
		name,
		icon,
		lightning,
		socialLinks,
		contact,
		notes
	} = await request.json();

	// if honey field has value return
	if (honey) {
		return;
	}

	// verify that captcha is correct
	/* eslint-disable no-undef */
	const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');
	/* eslint-enable no-undef */

	let decrypt = crypto.createDecipheriv('aes-256-cbc', serverKey, initVector);

	let secret = decrypt.update(captchaSecret, 'hex', 'utf8');
	secret += decrypt.final('utf8');

	if (captchaTest !== secret) {
		throw error(400, 'Captcha test failed, please try again or contact BTC Map.');
	}

	if (used.includes(captchaSecret)) {
		throw error(400, 'Captcha has already been used, please try another.');
	} else {
		used.push(captchaSecret);
	}

	let github = await axios
		.post(
			'https://api.github.com/repos/teambtcmap/btcmap-data/issues',
			{
				title: name,
				body: `Community name: ${name}
Location: ${location}
GeoJSON: https://geojson.easify.de/?search=${encodeURIComponent(location)}
Icon URL: ${icon}
Lightning: ${lightning}
Social links: ${socialLinks}
Community leader contact: ${contact}
Notes: ${notes}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}`,
				labels: ['community-submission']
			},
			{ headers }
		)
		.then(function (response) {
			return response.data;
		})
		.catch(function (error) {
			console.log(error);
			throw new Error(error);
		});

	return new Response(JSON.stringify(github));
}
