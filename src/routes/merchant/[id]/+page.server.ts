import { verifiedArr } from '$lib/map/setup';
import type { MerchantPageData, MerchantComment, PayMerchant, Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageServerLoad<MerchantPageData> = async ({ params }) => {
	const { id } = params;
	try {
		// Fetch complete data from v4 Places API (supports both numeric Place IDs and OSM-style IDs)
		const placeResponse = await axios.get(
			`https://api.btcmap.org/v4/places/${id}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
		);
		const placeData: Place = placeResponse.data;

		if (!placeData) {
			throw error(404, 'Merchant Not Found');
		}

		// Extract OSM type and ID from osm_url or osm_id for edit links
		let osmType: 'node' | 'way' | 'relation' = 'node'; // default
		let osmIdNum = Number(placeData.id); // fallback

		if (placeData.osm_url) {
			const osmMatch = placeData.osm_url.match(/openstreetmap\.org\/([^/]+)\/(\d+)/);
			if (osmMatch) {
				osmType = osmMatch[1] as 'node' | 'way' | 'relation';
				osmIdNum = Number(osmMatch[2]);
			}
		} else if (placeData.osm_id) {
			const parts = placeData.osm_id.split(':');
			if (parts.length === 2) {
				osmType = parts[0] as 'node' | 'way' | 'relation';
				osmIdNum = Number(parts[1]);
			}
		}

		const lat = placeData.lat;
		const lon = placeData.lon;

		if (!placeData.deleted_at) {
			let comments: MerchantComment[] = [];
			try {
				// Fetch comments directly from the dedicated comments endpoint
				const commentsResponse = await axios.get(`https://api.btcmap.org/v4/places/${id}/comments`);
				comments = commentsResponse.data;
			} catch {
				// Comments endpoint failed - use empty array
				comments = [];
			}

			// Process all merchant data server-side
			const icon = placeData.icon || 'question_mark';
			const address = placeData.address;
			const hours = placeData.opening_hours;

			const payment: PayMerchant = placeData['osm:payment:uri']
				? { type: 'uri', url: placeData['osm:payment:uri'] }
				: placeData['osm:payment:pouch']
					? { type: 'pouch', username: placeData['osm:payment:pouch'] }
					: placeData['osm:payment:coinos']
						? { type: 'coinos', username: placeData['osm:payment:coinos'] }
						: undefined;

			const boosted =
				placeData.boosted_until && Date.parse(placeData.boosted_until) > Date.now()
					? placeData.boosted_until
					: undefined;

			const verified = verifiedArr(placeData);
			const phone = placeData.phone || placeData['osm:contact:phone'];
			const website = placeData.website || placeData['osm:contact:website'];
			const email = placeData.email || placeData['osm:contact:email'];
			const twitter = placeData.twitter || placeData['osm:contact:twitter'];
			const instagram = placeData.instagram || placeData['osm:contact:instagram'];
			const facebook = placeData.facebook || placeData['osm:contact:facebook'];

			const thirdParty = placeData.required_app_url ? true : undefined;

			const paymentMethod =
				placeData['osm:payment:onchain'] ||
				placeData['osm:payment:lightning'] ||
				placeData['osm:payment:lightning_contactless'];

			// Map osm:payment:* fields to payment:* for osmTags (UI expects payment:* keys)
			const osmTags: Record<string, string> = {};
			if (placeData['osm:payment:onchain'])
				osmTags['payment:onchain'] = placeData['osm:payment:onchain'];
			if (placeData['osm:payment:lightning'])
				osmTags['payment:lightning'] = placeData['osm:payment:lightning'];
			if (placeData['osm:payment:lightning_contactless'])
				osmTags['payment:lightning_contactless'] = placeData['osm:payment:lightning_contactless'];
			if (placeData['osm:payment:lightning:companion_app_url'])
				osmTags['payment:lightning:companion_app_url'] =
					placeData['osm:payment:lightning:companion_app_url'];

			return {
				id: placeData.id.toString(),
				name: placeData.name,
				lat,
				lon,
				comments,
				// Additional processed fields
				icon,
				address,
				description: undefined, // Not available in v4 API
				note: undefined, // Not available in v4 API
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
				osmType,
				osmId: osmIdNum,
				osmTags,
				// Place data for BoostButton and other components
				placeData
			};
		}
		error(404, 'Merchant Not Found');
	} catch (err) {
		console.error(err);
		error(404, 'Merchant Not Found');
	}
};
