import axios from 'axios';
import { GITHUB_API_KEY } from '$env/static/private';
import crypto from 'crypto';
import { SERVER_CRYPTO_KEY, SERVER_INIT_VECTOR } from '$env/static/private';
import { error } from '@sveltejs/kit';

let used = [];

export async function POST({ request }) {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	let { captchaSecret, captchaTest, honey, location, name, icon, socialLinks, contact } =
		await request.json();

	// if honey field has value return
	if (honey) {
		return;
	}

	// verify that captcha is correct
	const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');

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
Min lat: ${location.minLat}
Min long: ${location.minLong}
Max lat: ${location.maxLat}
Max long: ${location.maxLong}
Icon URL: ${icon}
Social links: ${socialLinks}
Community leader contact: ${contact}
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
