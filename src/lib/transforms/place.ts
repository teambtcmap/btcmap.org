import type { OSMTags, PayMerchant, Place } from "$lib/types";

export type ContactFields = {
	phone?: string;
	website?: string;
	email?: string;
	twitter?: string;
	instagram?: string;
	facebook?: string;
};

export function getContactFields(place: Place): ContactFields {
	return {
		phone: place.phone || place["osm:contact:phone"],
		website: place.website || place["osm:contact:website"],
		email: place.email || place["osm:contact:email"],
		twitter: place.twitter || place["osm:contact:twitter"],
		instagram: place.instagram || place["osm:contact:instagram"],
		facebook: place.facebook || place["osm:contact:facebook"],
	};
}

export function mapPayment(place: Place): PayMerchant | undefined {
	if (place["osm:payment:uri"]) {
		return { type: "uri", url: place["osm:payment:uri"] };
	}
	if (place["osm:payment:pouch"]) {
		return { type: "pouch", username: place["osm:payment:pouch"] };
	}
	if (place["osm:payment:coinos"]) {
		return { type: "coinos", username: place["osm:payment:coinos"] };
	}
	return undefined;
}

export function getBoosted(place: Place): string | undefined {
	if (place.boosted_until && Date.parse(place.boosted_until) > Date.now()) {
		return place.boosted_until;
	}
	return undefined;
}

export function getPaymentMethod(place: Place): string | undefined {
	return (
		place["osm:payment:onchain"] ||
		place["osm:payment:lightning"] ||
		place["osm:payment:lightning_contactless"]
	);
}

export function buildOsmTags(place: Place, contact?: ContactFields): OSMTags {
	const tags: Record<string, any> = {};

	const contacts = contact || getContactFields(place);

	if (place.name) tags.name = place.name;
	if (place.address) tags["addr:full"] = place.address;
	if (place.description) tags.description = place.description;
	if (place["osm:note"]) tags.note = place["osm:note"];
	if (place.opening_hours) tags.opening_hours = place.opening_hours;

	if (contacts.phone) tags.phone = contacts.phone;
	if (contacts.website) tags.website = contacts.website;
	if (contacts.email) tags.email = contacts.email;
	if (contacts.twitter) tags["contact:twitter"] = contacts.twitter;
	if (contacts.facebook) tags["contact:facebook"] = contacts.facebook;
	if (contacts.instagram) tags["contact:instagram"] = contacts.instagram;

	if (place["osm:payment:onchain"])
		tags["payment:onchain"] = place["osm:payment:onchain"];
	if (place["osm:payment:lightning"])
		tags["payment:lightning"] = place["osm:payment:lightning"];
	if (place["osm:payment:lightning_contactless"])
		tags["payment:lightning_contactless"] =
			place["osm:payment:lightning_contactless"];
	if (place["osm:payment:lightning:companion_app_url"])
		tags["payment:lightning:companion_app_url"] =
			place["osm:payment:lightning:companion_app_url"];

	if (place["osm:survey:date"]) tags["survey:date"] = place["osm:survey:date"];
	if (place["osm:check_date"]) tags.check_date = place["osm:check_date"];
	if (place["osm:check_date:currency:XBT"])
		tags["check_date:currency:XBT"] = place["osm:check_date:currency:XBT"];
	if (place.verified_at) tags.verified_at = place.verified_at;

	if (place.icon) tags["icon:android"] = place.icon;
	if (place["osm:amenity"]) tags.amenity = place["osm:amenity"];
	if (place["osm:category"]) tags.category = place["osm:category"];

	if (place.osm_id) tags.osm_id = place.osm_id;
	if (place.osm_url) tags.osm_url = place.osm_url;
	tags.btcmap_id = place.id.toString();

	if (place.boosted_until) tags["boost:expires"] = place.boosted_until;

	if (place.created_at) tags.created_at = place.created_at;
	if (place.updated_at) tags.updated_at = place.updated_at;

	return tags;
}
