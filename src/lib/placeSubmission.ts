import type { PostPlaceSubmissionArgs } from "$types/btcmap-api/PostPlaceSubmissionArgs";

// The wire contract of POST /api/submit-place. The endpoint still treats
// the incoming body as untrusted unknowns and re-validates everything —
// this type exists so the client payload and the server's reads can't
// drift apart silently. Optionals mirror the form's element refs, which
// can be undefined.
export type SubmitPlaceRequest = {
	captchaSecret?: string;
	captchaTest?: string;
	honey?: string;
	name?: string;
	nameEn?: string;
	address?: string;
	lat: number;
	long: number;
	category: string;
	methods: string[];
	website?: string;
	phone?: string;
	hours?: string;
	notes?: string;
	contact?: string;
};

export type SubmitPlaceResponse = {
	id: number;
};

// The anonymous proxy's field set (#1374): signed-in submissions never
// reach it — they go straight to POST /v4/place-submissions, so no
// identity fields live here any more.
export type AddLocationSubmission = {
	name: string;
	nameEn: string;
	address: string;
	lat: number;
	long: number;
	category: string;
	methods: string[];
	website: string;
	phone: string;
	hours: string;
	notes: string;
	contact: string;
};

export type SubmitPlaceParams = {
	origin: "btcmap-website";
	external_id: string;
	lat: number;
	lon: number;
	category: string;
	name: string;
	extra_fields: Record<string, string>;
};

// Deep link into OSM's editor on the pin — recorded on every submission
// for the volunteer, and offered to OSM-capable submitters as the
// direct edit path (#1344). Deliberately nothing but the map position
// (maintainer call on the PR): changeset-prefill hash params didn't
// survive osm.org's routing in the maintainer's live test, and forcing
// ?editor=id would override the user's chosen editor — both can be
// revisited in a later optimization pass. Zoom 19 is a deliberate
// choice, not a ceiling: /edit hands this hash to iD, which clamps only
// at 24 — the 19 limit belongs to osm.org's standard *tile* layer on the
// browse map, not to the editor — so a tighter zoom would be honoured.
// 19 keeps the neighbouring buildings in frame, which is what lets a
// mapper notice the place already exists as an untagged node or way
// before adding a duplicate.
export const osmEditUrl = (lat: number, long: number): string =>
	`https://www.openstreetmap.org/edit#map=19/${lat}/${long}`;

// Maps the add-location form to btcmap-api's submit_place params: the four
// first-class fields plus everything else as extra_fields. The API's field
// is `lon`, the form's is `long`. Empty optionals are dropped so the
// submission record stays clean.
export const buildSubmitPlaceParams = (
	form: AddLocationSubmission,
	externalId: string,
): SubmitPlaceParams => {
	const optional: Record<string, string> = {
		"name:en": form.nameEn,
		address: form.address,
		payment_methods: form.methods.join(","),
		website: form.website,
		phone: form.phone,
		opening_hours: form.hours,
		notes: form.notes,
		contact: form.contact,
		osm_edit_url: osmEditUrl(form.lat, form.long),
	};
	const extra_fields = Object.fromEntries(
		Object.entries(optional).filter(([, value]) => value.trim() !== ""),
	);
	return {
		origin: "btcmap-website",
		external_id: externalId,
		lat: form.lat,
		lon: form.long,
		category: form.category,
		name: form.name,
		extra_fields,
	};
};

// The authorized path (#1374): a signed-in client POSTs these to
// /v4/place-submissions with its own Bearer token — the endpoint the
// Android form uses. Identity comes from the token and extra_fields are
// place fields (#1348), so no submitter identity or contact goes here.
export const buildPlaceSubmissionArgs = (
	form: Omit<AddLocationSubmission, "contact">,
): PostPlaceSubmissionArgs => {
	const optional: Record<string, string> = {
		"name:en": form.nameEn,
		address: form.address,
		payment_methods: form.methods.join(","),
		website: form.website,
		phone: form.phone,
		opening_hours: form.hours,
		notes: form.notes,
		osm_edit_url: osmEditUrl(form.lat, form.long),
	};
	return {
		lat: form.lat,
		lon: form.long,
		category: form.category,
		name: form.name,
		extra_fields: Object.fromEntries(
			Object.entries(optional).filter(([, value]) => value.trim() !== ""),
		),
	};
};
