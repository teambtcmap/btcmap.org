import { verifiedArr } from '$lib/map/setup';
import type { MerchantPageData, MerchantComment, PayMerchant, Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { isValidPlaceId } from '$lib/utils';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageServerLoad<MerchantPageData> = async ({ params }) => {
	const { id } = params;

	// Validate id parameter format (numeric or OSM-style type:id)
	if (!isValidPlaceId(id)) {
		error(404, 'Merchant Not Found');
	}

	try {
		// Fetch complete data from v4 Places API (supports both numeric Place IDs and OSM-style IDs)
		const placeResponse = await axios.get(
			`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
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

		let comments: MerchantComment[] = [];

		try {
			// Fetch comments directly from the dedicated comments endpoint
			const commentsResponse = await axios.get(
				`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}/comments`
			);
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

		// Build osmTags from Place data for the OSM tag modal
		const osmTags: Record<string, string> = {};

		// Core info
		if (placeData.name) osmTags['name'] = placeData.name;
		if (placeData.address) osmTags['addr:full'] = placeData.address;
		if (placeData.description) osmTags['description'] = placeData.description;
		if (placeData['osm:note']) osmTags['note'] = placeData['osm:note'];
		if (placeData.opening_hours) osmTags['opening_hours'] = placeData.opening_hours;

		// Contact info
		if (phone) osmTags['phone'] = phone;
		if (website) osmTags['website'] = website;
		if (email) osmTags['email'] = email;
		if (twitter) osmTags['contact:twitter'] = twitter;
		if (facebook) osmTags['contact:facebook'] = facebook;
		if (instagram) osmTags['contact:instagram'] = instagram;

		// Payment methods - The v4 API returns osm:payment:* fields, but the UI
		// and OSM tag modal expect the standard OSM tag format (payment:*), so we
		// map them here for display compatibility
		if (placeData['osm:payment:onchain'])
			osmTags['payment:onchain'] = placeData['osm:payment:onchain'];
		if (placeData['osm:payment:lightning'])
			osmTags['payment:lightning'] = placeData['osm:payment:lightning'];
		if (placeData['osm:payment:lightning_contactless'])
			osmTags['payment:lightning_contactless'] = placeData['osm:payment:lightning_contactless'];
		if (placeData['osm:payment:lightning:companion_app_url'])
			osmTags['payment:lightning:companion_app_url'] =
				placeData['osm:payment:lightning:companion_app_url'];

		// Survey/verification dates
		if (placeData['osm:survey:date']) osmTags['survey:date'] = placeData['osm:survey:date'];
		if (placeData['osm:check_date']) osmTags['check_date'] = placeData['osm:check_date'];
		if (placeData['osm:check_date:currency:XBT'])
			osmTags['check_date:currency:XBT'] = placeData['osm:check_date:currency:XBT'];
		if (placeData.verified_at) osmTags['verified_at'] = placeData.verified_at;

		// Metadata
		if (placeData.icon) osmTags['icon:android'] = placeData.icon;
		if (placeData['osm:amenity']) osmTags['amenity'] = placeData['osm:amenity'];
		if (placeData['osm:category']) osmTags['category'] = placeData['osm:category'];

		// IDs and URLs
		if (placeData.osm_id) osmTags['osm_id'] = placeData.osm_id;
		if (placeData.osm_url) osmTags['osm_url'] = placeData.osm_url;
		osmTags['btcmap_id'] = placeData.id.toString();

		// Boost
		if (placeData.boosted_until) osmTags['boost:expires'] = placeData.boosted_until;

		// Timestamps
		if (placeData.created_at) osmTags['created_at'] = placeData.created_at;
		if (placeData.updated_at) osmTags['updated_at'] = placeData.updated_at;

		return {
			id: placeData.id.toString(),
			name: placeData.name,
			lat,
			lon,
			comments,
			// Additional processed fields
			icon,
			address,
			description: placeData.description,
			note: placeData['osm:note'],
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
	} catch (err) {
		console.error(err);
		error(404, 'Merchant Not Found');
	}
};
