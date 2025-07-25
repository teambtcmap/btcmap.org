import { latCalc, longCalc, checkAddress, verifiedArr } from '$lib/map/setup';
import type { Element, MerchantPageData, MerchantComment, PayMerchant } from '$lib/types';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageServerLoad<MerchantPageData> = async ({ params }) => {
	const { id } = params;
	try {
		// Use v2 Elements API for comprehensive merchant data
		const response = await axios.get(`https://api.btcmap.org/v2/elements/${id}`);

		const data: Element = response.data;
		const lat = latCalc(data.osm_json);
		const lon = longCalc(data.osm_json);

		if (data && data.id && lat && lon && !data['deleted_at']) {
			// Parse numeric ID from "node:12345" format for v4 comments API
			let numericId: number;
			if (id.includes(':')) {
				const parts = id.split(':');
				numericId = parseInt(parts[1], 10);
			} else {
				numericId = parseInt(id, 10);
			}

			let comments: MerchantComment[] = [];
			try {
				// Use same API approach as popup - get place details with comments field
				const placeResponse = await axios.get(
					`https://api.btcmap.org/v4/places/${numericId}?fields=comments`
				);
				const placeData = placeResponse.data;

				// If comments field exists and is an array, use it; otherwise fetch from comments endpoint
				if (Array.isArray(placeData.comments)) {
					comments = placeData.comments;
				} else if (placeData.comments > 0) {
					// If it's a count, fetch full comments from dedicated endpoint
					const commentsResponse = await axios.get(
						`https://api.btcmap.org/v4/places/${numericId}/comments`
					);
					comments = commentsResponse.data;
				}
			} catch (_commentErr) {
				// Place doesn't exist in v4 API or comments failed - use empty array
				comments = [];
			}

			// Process all merchant data server-side (same logic as client initializeData)
			const icon = data.tags['icon:android'];
			const address = data.osm_json.tags && checkAddress(data.osm_json.tags);
			const description = data.osm_json.tags?.description;
			const note = data.osm_json.tags?.note;
			const hours = data.osm_json.tags?.['opening_hours'];

			const payment: PayMerchant = data.tags['payment:uri']
				? { type: 'uri', url: data.tags['payment:uri'] }
				: data.tags['payment:pouch']
					? { type: 'pouch', username: data.tags['payment:pouch'] }
					: data.tags['payment:coinos']
						? { type: 'coinos', username: data.tags['payment:coinos'] }
						: undefined;

			const boosted =
				data.tags['boost:expires'] && Date.parse(data.tags['boost:expires']) > Date.now()
					? data.tags['boost:expires']
					: undefined;

			const verified = verifiedArr(data.osm_json);
			const phone = data.osm_json.tags?.phone || data.osm_json.tags?.['contact:phone'];
			const website = data.osm_json.tags?.website || data.osm_json.tags?.['contact:website'];
			const email = data.osm_json.tags?.email || data.osm_json.tags?.['contact:email'];
			const twitter = data.osm_json.tags?.twitter || data.osm_json.tags?.['contact:twitter'];
			const instagram = data.osm_json.tags?.instagram || data.osm_json.tags?.['contact:instagram'];
			const facebook = data.osm_json.tags?.facebook || data.osm_json.tags?.['contact:facebook'];

			const thirdParty =
				data.osm_json.tags?.['payment:lightning:requires_companion_app'] === 'yes' &&
				data.osm_json.tags['payment:lightning:companion_app_url'];

			const paymentMethod =
				data.osm_json.tags &&
				(data.osm_json.tags['payment:onchain'] ||
					data.osm_json.tags['payment:lightning'] ||
					data.osm_json.tags['payment:lightning_contactless']);

			return {
				id: data.id,
				name: data.osm_json.tags?.name,
				lat,
				lon,
				comments,
				// Additional processed fields
				icon,
				address,
				description,
				note,
				hours,
				payment,
				boosted,
				verified,
				phone,
				website,
				email,
				twitter,
				instagram,
				facebook,
				thirdParty,
				paymentMethod,
				// OSM data for edit links and tag functionality
				osmType: data.osm_json.type,
				osmId: data.osm_json.id,
				osmTags: data.osm_json.tags || {},
				// Full element data for complex client logic
				elementData: data
			};
		}
		error(404, 'Merchant Not Found');
	} catch (err) {
		console.error(err);
		error(404, 'Merchant Not Found');
	}
};
