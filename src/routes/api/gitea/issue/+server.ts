import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import type { CipherKey, BinaryLike } from 'crypto';
import { createIssueWithLabels, type GiteaRepo } from '$lib/gitea';
import { GITEA_LABELS } from '$lib/constants';
import { getAreaIdsByCoordinates } from '$lib/utils';
import { get } from 'svelte/store';
import { areas } from '$lib/store';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const used: string[] = [];

type IssueType = 'add-location' | 'verify-location' | 'community' | 'tagger-onboarding';

type IssueConfig = {
	repo: GiteaRepo;
	labelId: number;
	hasAreaLabels: boolean;
};

const CONFIG: Record<IssueType, IssueConfig> = {
	'add-location': {
		repo: 'btcmap-data',
		labelId: GITEA_LABELS.DATA.ADD_LOCATION,
		hasAreaLabels: true
	},
	'verify-location': {
		repo: 'btcmap-data',
		labelId: GITEA_LABELS.DATA.VERIFY_LOCATION,
		hasAreaLabels: true
	},
	community: {
		repo: 'btcmap-data',
		labelId: GITEA_LABELS.DATA.COMMUNITY_SUBMISSION,
		hasAreaLabels: false
	},
	'tagger-onboarding': {
		repo: 'btcmap-infra',
		labelId: GITEA_LABELS.INFRA.TAGGER_ONBOARDING,
		hasAreaLabels: false
	}
};

function validateCaptcha(captchaSecret: string, captchaTest: string): void {
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
}

async function getAreaLabelsFromCoordinates(
	lat: number,
	long: number
): Promise<{ labels: string[]; text: string }> {
	const associatedAreaIds = await getAreaIdsByCoordinates(lat, long);
	const areasData = get(areas);
	const filteredAreas = associatedAreaIds
		.map((id) => areasData.find((a) => a.id === id))
		.filter(Boolean);

	const labels = filteredAreas
		.map((area) => area?.tags?.url_alias || area?.id)
		.filter((label): label is string => Boolean(label));

	const text = filteredAreas
		.map((area) => `${area?.tags.name} (${area?.tags?.url_alias || area?.id})`)
		.join(', ');

	return { labels, text };
}

function generateBody(type: IssueType, data: Record<string, unknown>, areasText: string): string {
	const timestamp = new Date(Date.now()).toISOString();
	const taggingInstructions = `If you are a new contributor please read our Tagging Instructions [here](https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants).`;

	switch (type) {
		case 'add-location':
			return `Merchant name: ${data.name}
Address: ${data.address}
Lat: ${data.lat}
Long: ${data.long}
Associated areas: ${areasText}
OSM: ${data.osm}
Category: ${data.category}
Payment methods: ${data.methods}
Website: ${data.website}
Phone: ${data.phone}
Opening hours: ${data.hours}
Notes: ${data.notes}
Data Source: ${data.source}
Details (if applicable): ${data.sourceOther}
Contact: ${data.contact}
Created at: ${timestamp}

${taggingInstructions}`;

		case 'verify-location':
			return `Merchant name: ${data.name}
Merchant location: ${data.location}
Coordinates: ${data.lat}, ${data.long}
Associated areas: ${areasText}
Edit link: ${data.edit}
Current information correct: ${data.current}
Outdated information: ${data.outdated}
How did you verify this?: ${data.verified}
Created at: ${timestamp}

${taggingInstructions}`;

		case 'community':
			return `Community name: ${data.name}
Location: ${data.location}
GeoJSON: https://geojson.codingarena.top/?search=${encodeURIComponent(String(data.location))}
Icon URL: ${data.icon}
Lightning: ${data.lightning}
Social links: ${data.socialLinks}
Community leader contact: ${data.contact}
Notes: ${data.notes}
Created at: ${timestamp}`;

		case 'tagger-onboarding':
			return `Name: ${data.name}
Email: ${data.email}
Created at: ${timestamp}

New tagger onboarding request.`;

		default:
			error(400, 'Invalid issue type');
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const { type, captchaSecret, captchaTest, honey, ...data } = await request.json();

	if (honey) {
		error(418);
	}

	if (!type || !CONFIG[type as IssueType]) {
		error(400, 'Invalid issue type');
	}

	validateCaptcha(captchaSecret, captchaTest);

	const config = CONFIG[type as IssueType];
	let areaLabels: string[] = [];
	let areasText = '';

	if (config.hasAreaLabels && data.lat && data.long) {
		const areaData = await getAreaLabelsFromCoordinates(data.lat, data.long);
		areaLabels = areaData.labels;
		areasText = areaData.text;
	}

	const body = generateBody(type as IssueType, data, areasText);
	const title = String(data.name);

	const response = await createIssueWithLabels(
		title,
		body,
		[config.labelId],
		config.repo,
		areaLabels
	);

	return new Response(JSON.stringify(response.data));
};
