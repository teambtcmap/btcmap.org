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
	console.log('Verify location POST endpoint called');
	const {
		captchaSecret,
		captchaTest,
		honey,
		name,
		location,
		edit,
		current,
		outdated,
		verified,
		merchantId,
		lat,
		long
	} = await request.json();

	console.log('Request data:', {
		name,
		location,
		current,
		outdated,
		merchantId
	});

	if (honey) {
		error(418);
	}

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

	const standardLabels = ['location-verification'];

	// Create filtered list of matched areas for reuse
	const associatedAreaIds = lat && long ? await getAreaIdsByCoordinates(lat, long) : [];
	const areasData = get(areas);
	const filteredAreas = associatedAreaIds
		.map((id) => areasData.find((a) => a.id === id))
		.filter(Boolean);

	const areaLabels = filteredAreas
		.map((area) => area?.tags?.url_alias || area?.id)
		.filter((label): label is string => Boolean(label));
	const allLabels = [...standardLabels, ...areaLabels];

	const body = `Merchant name: ${name}
Merchant location: ${location}
Coordinates: ${lat}, ${long}
Associated areas: ${filteredAreas.map((area) => `${area?.tags.name} (${area?.tags?.url_alias || area?.id})`).join(', ')}
Edit link: ${edit}
Current information correct: ${current}
Outdated information: ${outdated}
How did you verify this?: ${verified}
Created at: ${new Date(Date.now()).toISOString()}

If you are a new contributor please read our Tagging Instructions [here](https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants).`;

	const response = await createIssueWithLabels(name, body, allLabels);
	return new Response(JSON.stringify(response.data));
};
