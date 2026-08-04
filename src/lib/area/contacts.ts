import type { AreaContacts, AreaTags } from "$lib/types";
import { AREA_CONTACT_KEYS } from "$lib/types";

// Lift the 22 `contact:*` string tags into one typed object so consumers
// stop spelling `area["contact:satlantis"]` at every read site. Shared by
// the SSR area bundle (areaSectionLoad) and the communities-map popups.
export const extractContacts = (tags: AreaTags): AreaContacts => {
	const contacts: AreaContacts = {};
	for (const key of AREA_CONTACT_KEYS) {
		const value = tags[`contact:${key}`];
		if (typeof value === "string" && value) {
			contacts[key] = value;
		}
	}
	return contacts;
};
