import { error } from "@sveltejs/kit";
import axios from "axios";

import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
import api from "$lib/axios";
import { verifiedArr } from "$lib/map/setup";
import {
	buildOsmTags,
	getBoosted,
	getContactFields,
	getPaymentMethod,
	mapPayment,
} from "$lib/transforms/place";
import type {
	MerchantActivityEvent,
	MerchantArea,
	MerchantComment,
	MerchantPageData,
	Place,
} from "$lib/types";
import { isValidPlaceId } from "$lib/utils";

import type { PageServerLoad } from "./$types";

// Non-retrying instance for secondary fetches that should fail fast
const fastAxios = axios.create({
	timeout: 8000,
	headers: { "User-Agent": "btcmap.org" },
});

export const load: PageServerLoad<MerchantPageData> = async ({ params }) => {
	const { id } = params;

	// Validate id parameter format (numeric or OSM-style type:id)
	if (!isValidPlaceId(id)) {
		error(404, "Merchant Not Found");
	}

	try {
		// Fetch complete data from v4 Places API (supports both numeric Place IDs and OSM-style IDs)
		// include_deleted=true is required so deleted places return full field data instead of id-only
		const placeResponse = await api.get(
			`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}&include_deleted=true`,
		);
		const placeData: Place = placeResponse.data;

		if (!placeData) {
			throw error(404, "Merchant Not Found");
		}

		const lat = placeData.lat;
		const lon = placeData.lon;

		// Fetch comments and areas in parallel since they're independent
		const [commentsResult, areasResult, activityResult] =
			await Promise.allSettled([
				fastAxios.get<MerchantComment[]>(
					`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}/comments`,
				),
				fastAxios.get<MerchantArea[]>(
					`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}/areas?type=community`,
				),
				fastAxios.get<MerchantActivityEvent[]>(
					`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}/activity`,
				),
			]);

		const comments =
			commentsResult.status === "fulfilled" ? commentsResult.value.data : [];
		const areas =
			areasResult.status === "fulfilled" ? areasResult.value.data : [];
		const activity =
			activityResult.status === "fulfilled" ? activityResult.value.data : [];

		// Process all merchant data server-side
		const icon = placeData.icon || "question_mark";
		const address = placeData.address;
		const hours = placeData.opening_hours;

		const payment = mapPayment(placeData);
		const boosted = getBoosted(placeData);
		const verified = verifiedArr(placeData);
		const contact = getContactFields(placeData);
		const { phone, website, email, twitter, instagram, facebook } = contact;

		const thirdParty = placeData.required_app_url ? true : undefined;

		const paymentMethod = getPaymentMethod(placeData);

		// Build osmTags from Place data for the OSM tag modal
		const osmTags = buildOsmTags(placeData, contact);

		return {
			id: placeData.id.toString(),
			name: placeData.name,
			localizedName: placeData.localized_name,
			lat,
			lon,
			comments,
			areas,
			activity,
			// Additional processed fields
			icon,
			address,
			description: placeData.description,
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
			osmTags,
			// Place data for BoostButton and other components
			placeData,
			osmViewUrl: placeData.osm_url ?? "",
			osmEditUrl: placeData.osm_edit_url ?? "",
		};
	} catch (err) {
		console.error(err);
		error(404, "Merchant Not Found");
	}
};
