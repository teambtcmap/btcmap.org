import { SERVER_CRYPTO_KEY, SERVER_INIT_VECTOR } from '$env/static/private';
import { error } from '@sveltejs/kit';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import type { CipherKey, BinaryLike } from 'crypto';
import { getAreaIdsByCoordinates } from '$lib/utils';
import { createIssueWithLabels } from '$lib/gitea';
import { get } from 'svelte/store';
import { areas } from '$lib/store';

const used: string[] = [];

export const POST: RequestHandler = async ({ request }) => {
	const {
		captchaSecret,
		captchaTest,
		honey,
		location,
		name,
		icon,
		lightning,
		socialLinks,
		contact,
		notes,
		lat,
		long
	} = await request.json();

	// if honey field has value return
	if (honey) {
		error(418);
	}

	// verify that captcha is correct
	const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');

	const algorithm = 'aes-256-cbc' as string;
	const key = serverKey as unknown as CipherKey;
	const iv = initVector as unknown as BinaryLike;
	const decrypt = crypto.createDecipheriv(algorithm, key, iv);

	let secret = decrypt.update(captchaSecret, 'hex', 'utf8');
	secret += decrypt.final('utf8');

	if (captchaTest !== secret) {
		error(400, 'Captcha test failed, please try again or contact BTC Map.');
	}

	if (used.includes(captchaSecret)) {
		error(400, 'Captcha has already been used, please try another.');
	} else {
		used.push(captchaSecret);
	}

	const standardLabels = ['community-submission'];
	const areas = lat && long ? await getAreaIdsByCoordinates(lat, long) : [];
	const areaLabels = areas.map(([id, alias]) => alias || id).filter(Boolean);
	const labels = [...standardLabels, ...areaLabels];

	const body = `Community name: ${name}
Location: ${location}
GeoJSON: https://geojson.codingarena.top/?search=${encodeURIComponent(location)}
Icon URL: ${icon}
Lightning: ${lightning}
Social links: ${socialLinks}
Community leader contact: ${contact}
Notes: ${notes}
Created at: ${new Date(Date.now()).toISOString()}`;

	const response = await createIssueWithLabels(name, body, labels);
	const gitea = response.data;

	return new Response(JSON.stringify(gitea));
};