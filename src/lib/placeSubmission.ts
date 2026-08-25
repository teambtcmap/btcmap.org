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
	source: string;
	sourceOther: string;
	contact: string;
};

export type SubmitPlaceParams = {
	origin: "website";
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
		data_source: form.source,
		data_source_details: form.sourceOther,
		contact: form.contact,
		osm_edit_url: `https://www.openstreetmap.org/edit#map=21/${form.lat}/${form.long}`,
	};
	const extra_fields = Object.fromEntries(
		Object.entries(optional).filter(([, value]) => value.trim() !== ""),
	);
	return {
		origin: "website",
		external_id: externalId,
		lat: form.lat,
		lon: form.long,
		category: form.category,
		name: form.name,
		extra_fields,
	};
};
