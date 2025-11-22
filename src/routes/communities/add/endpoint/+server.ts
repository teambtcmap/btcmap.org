import { env } from '$env/dynamic/private';
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
	if (!env.SERVER_CRYPTO_KEY || !env.SERVER_INIT_VECTOR) {
		error(503, 'Service unavailable');
	}
	const initVector = Buffer.from(env.SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(env.SERVER_CRYPTO_KEY, 'hex');

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

	// Create filtered list of matched areas (i.e. countries or larger communities) for reuse
	const associatedAreaIds = lat && long ? await getAreaIdsByCoordinates(lat, long) : [];
	const areasData = get(areas);
	const filteredAreas = associatedAreaIds
		.map((id) => areasData.find((a) => a.id === id))
		.filter(Boolean);

	const areaLabels = filteredAreas
		.map((area) => area?.tags?.url_alias || area?.id)
		.filter((label): label is string => Boolean(label)); // Filter out undefined values
	const labels = [...standardLabels, ...areaLabels];

	const body = `Community name: ${name}
Location: ${location}
Associated areas: ${filteredAreas.map((area) => `${area?.tags.name} (${area?.tags?.url_alias || area?.id})`).join(', ')}
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
