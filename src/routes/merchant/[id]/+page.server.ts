import { error, isHttpError } from "@sveltejs/kit";

import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
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

async function fetchJson<T>(
	fetch: typeof globalThis.fetch,
	url: string,
): Promise<T | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

export const load: PageServerLoad<MerchantPageData> = async ({
	params,
	fetch,
}) => {
	const { id } = params;

	// Validate id parameter format (numeric or OSM-style type:id)
	if (!isValidPlaceId(id)) {
		error(404, "Merchant Not Found");
	}

	try {
		// Fetch complete data from v4 Places API (supports both numeric Place IDs and OSM-style IDs)
		// include_deleted=true is required so deleted places return full field data instead of id-only
		const placeResponse = await fetch(
			`https://api.btcmap.org/v4/places/${encodeURIComponent(id)}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}&include_deleted=true`,
		);

		if (!placeResponse.ok) {
			if (placeResponse.status === 404 || placeResponse.status === 410) {
				throw error(404, "Merchant Not Found");
			}
			throw error(502, "Upstream API error");
		}

		const placeData: Place = await placeResponse.json();

		if (!placeData) {
			throw error(404, "Merchant Not Found");
		}

		const lat = placeData.lat;
		const lon = placeData.lon;

		const encodedId = encodeURIComponent(id);

		// Fetch comments, areas, and activity in parallel — failures return empty arrays
		const [comments, areas, activity] = await Promise.all([
			fetchJson<MerchantComment[]>(
				fetch,
				`https://api.btcmap.org/v4/places/${encodedId}/comments`,
			).then((data) => data ?? []),
			fetchJson<MerchantArea[]>(
				fetch,
				`https://api.btcmap.org/v4/places/${encodedId}/areas?type=community`,
			).then((data) => data ?? []),
			fetchJson<MerchantActivityEvent[]>(
				fetch,
				`https://api.btcmap.org/v4/places/${encodedId}/activity`,
			).then((data) => data ?? []),
		]);

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
		if (isHttpError(err)) throw err;
		error(502, "Upstream API error");
	}
};
