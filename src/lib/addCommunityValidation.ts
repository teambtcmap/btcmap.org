import { firstInvalid } from "$lib/formValidation";

// /communities/add's rules (#1409). The page runs `novalidate` and checks
// these on submit instead, so every field reports its error inline, the
// #1404 way. Kept DOM-free so the rules are unit-tested; the page maps
// each code to a message.
export type CommunityInput = {
	// A search result was picked: a typed query isn't a location.
	locationSelected: boolean;
	name: string;
	icon: string;
	socials: string;
	contact: string;
	captcha: string;
};

export type CommunityErrors = {
	location?: "required";
	name?: "required";
	icon?: "invalid";
	socials?: "required";
	contact?: "required";
	captcha?: "required";
};

export type CommunityField = keyof CommunityErrors;

// Top to bottom as the page renders them.
export const COMMUNITY_FIELDS: CommunityField[] = [
	"location",
	"name",
	"icon",
	"socials",
	"contact",
	"captcha",
];

export const firstInvalidCommunityField = (
	errors: CommunityErrors,
): CommunityField | undefined => firstInvalid(COMMUNITY_FIELDS, errors);

// The icon ends up as an image on btcmap.org, which is served over https:
// a plain-http image would be mixed content, upgraded or blocked by the
// browser, so only https is accepted.
const isHttpsUrl = (value: string): boolean => {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
};

export const validateCommunity = (input: CommunityInput): CommunityErrors => {
	const errors: CommunityErrors = {};
	if (!input.locationSelected) errors.location = "required";
	if (!input.name.trim()) errors.name = "required";
	// Optional.
	const icon = input.icon.trim();
	if (icon && !isHttpsUrl(icon)) errors.icon = "invalid";
	if (!input.socials.trim()) errors.socials = "required";
	if (!input.contact.trim()) errors.contact = "required";
	if (!input.captcha.trim()) errors.captcha = "required";
	return errors;
};
