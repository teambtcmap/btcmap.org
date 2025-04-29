import {
	GITHUB_API_KEY,
	OPENCAGE_API_KEY,
	SERVER_CRYPTO_KEY,
	SERVER_INIT_VECTOR
} from '$env/static/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import type { RequestHandler } from './$types';

import type { CipherKey, BinaryLike } from 'crypto';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const used: string[] = [];

export const POST: RequestHandler = async ({ request }) => {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	const {
		captchaSecret,
		captchaTest,
		honey,
		name,
		address,
		lat,
		long,
		osm,
		category,
		methods,
		website,
		phone,
		hours,
		twitterMerchant,
		twitterSubmitter,
		notes,
		source,
		sourceOther,
		contact,
		communities
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

	const country = await axios
		.get(
			`https://api.opencagedata.com/geocode/v1/json?q=${lat.slice(0, 7)}%2C%20${long.slice(
				0,
				7
			)}&key=${OPENCAGE_API_KEY}&language=en&limit=1&no_annotations=1&no_record=1`
		)
		.then(function (response) {
			return response.data.results[0].components.country;
		})
		.catch(function (error) {
			console.error(error);
		});

	const standardLabels = ['location-submission'];

	// Try to create issue with labels, if it fails due to missing labels, create without labels
const createIssue = async (labels?: string[]) => {
  return axios.post(
    'https://api.github.com/repos/teambtcmap/btcmap-data/issues',
    {
      title: name,
      body: `Merchant name: ${name}
Country: ${country ? country : ''}
Communities: ${communities.length ? communities.join(', ') : ''}
Address: ${address}
Lat: ${lat}
Long: ${long}
OSM: ${osm}
Category: ${category}
Payment methods: ${methods}
Website: ${website}
Phone: ${phone}
Opening hours: ${hours}
Twitter merchant: ${twitterMerchant}
Twitter submitter: ${twitterSubmitter}
Notes: ${notes}
Data Source: ${source}
Details (if applicable): ${sourceOther}
Contact: ${contact}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}

If you are a new contributor please read our Tagging Instructions [here](https://wiki.btcmap.org/general/tagging-instructions.html).`,
				labels: labels
    },
    { headers }
  );
};

const labels = country && communities.length
  ? [...standardLabels, country, ...communities]
  : country
    ? [...standardLabels, country]
    : communities.length
      ? [...standardLabels, ...communities]
      : [...standardLabels];

const github = await createIssue(labels)
  .then(function (response) {
    return response.data;
  })
  .catch(async function (error) {
    if (error.response?.status === 422) { // Label doesn't exist error
      console.warn('Failed to create issue with labels, retrying without labels');
      return createIssue() // Retry without any labels
        .then(response => response.data)
        .catch(error => {
          console.error(error);
          throw new Error('Failed to create issue even without labels');
        });
    }
    console.error(error);
    throw new Error('Failed to create issue');
  });

	return new Response(JSON.stringify(github));
};
