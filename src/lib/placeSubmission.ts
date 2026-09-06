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
	// Whether a verified account was attached (#1334) — the authoritative
	// answer; the client's belief can be stale.
	attributed: boolean;
};

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
	// Verified server-side against /v4/users/me — never client-claimed.
	// Empty when the submission is anonymous.
	submittedBy: string;
	submitterNpub: string;
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
		submitted_by: form.submittedBy,
		submitter_npub: form.submitterNpub,
		osm_edit_url: `https://www.openstreetmap.org/edit#map=21/${form.lat}/${form.long}`,
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
