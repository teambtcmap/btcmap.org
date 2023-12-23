import { LNBITS_API_KEY, LNBITS_URL, LNBITS_WALLET_ID } from '$env/static/private';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageServerLoad = async () => {
	const headers = {
		'X-API-Key': `${LNBITS_API_KEY}`,
		'Content-type': 'application/json'
	};

	try {
		const address = await axios.get(
			`https://${LNBITS_URL}/watchonly/api/v1/address/${LNBITS_WALLET_ID}`,
			{ headers }
		);

		return { address: address.data.address };
	} catch (error) {
		console.log(error);
		return { address: 'bc1qqmy5c03clt6a72aq0ys5jzm2sjnws3qr05nvmz' };
	}
};
