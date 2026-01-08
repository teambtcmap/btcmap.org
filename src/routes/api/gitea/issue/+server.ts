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

// TTL-based cache for used captcha secrets to prevent memory leaks
const CAPTCHA_TTL_MS = 10 * 60 * 1000; // 10 minutes
const usedCaptchas = new Map<string, number>();

function addUsedCaptcha(secret: string): void {
	usedCaptchas.set(secret, Date.now());
	// Clean up expired entries periodically
	if (usedCaptchas.size > 100) {
		const now = Date.now();
		for (const [key, timestamp] of usedCaptchas) {
			if (now - timestamp > CAPTCHA_TTL_MS) {
				usedCaptchas.delete(key);
			}
		}
	}
}

function isCaptchaUsed(secret: string): boolean {
	const timestamp = usedCaptchas.get(secret);
	if (!timestamp) return false;
	// Check if expired
	if (Date.now() - timestamp > CAPTCHA_TTL_MS) {
		usedCaptchas.delete(secret);
		return false;
	}
	return true;
}

type IssueConfig = {
	repo: GiteaRepo;
	labelId: number;
	hasAreaLabels: boolean;
};

const CONFIG = {
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
} satisfies Record<string, IssueConfig>;

type IssueType = keyof typeof CONFIG;

function isValidIssueType(type: unknown): type is IssueType {
	return typeof type === 'string' && type in CONFIG;
}

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

	if (isCaptchaUsed(captchaSecret)) {
		error(400, 'Captcha has already been used, please try another.');
	} else {
		addUsedCaptcha(captchaSecret);
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
		.map((area) => `${area?.tags?.name} (${area?.tags?.url_alias || area?.id})`)
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

	if (!isValidIssueType(type)) {
		error(400, 'Invalid issue type');
	}

	validateCaptcha(captchaSecret, captchaTest);

	// type is now narrowed to IssueType after validation
	const config = CONFIG[type];
	let areaLabels: string[] = [];
	let areasText = '';

	if (config.hasAreaLabels && data.lat && data.long) {
		const areaData = await getAreaLabelsFromCoordinates(data.lat, data.long);
		areaLabels = areaData.labels;
		areasText = areaData.text;
	}

	const body = generateBody(type, data, areasText);
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
