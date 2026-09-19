import { firstInvalid } from "$lib/formValidation";
import type { PaymentMethod } from "$lib/map/paymentMethodFilter";

// The add-location form's edit-step rules (#1404). The form runs with
// `novalidate` and checks these on Review & submit instead, so every
// field reports its error the same way: inline, under its label. Kept
// DOM-free so the rules are unit-tested; the form reads its inputs into
// a DetailsInput and maps each error code to a message.

export type DetailsInput = {
	name: string;
	address: string;
	// A landed address suggestion makes the field required (#1315).
	addressRequired: boolean;
	// The select's value: "" before a pick, "Other" for the free-text path.
	category: string;
	categoryOther: string;
	methods: PaymentMethod[];
	website: string;
	contact: string;
	// Anonymous submissions only — an attached account needs no email.
	contactRequired: boolean;
};

export type DetailsErrors = {
	name?: "required";
	address?: "required";
	category?: "required" | "otherRequired";
	methods?: "required";
	website?: "invalid";
	contact?: "required" | "invalid";
};

export type DetailsField = keyof DetailsErrors;

// Top to bottom as the form renders them: the first invalid field in
// this order is the one that takes focus.
export const DETAILS_FIELDS: DetailsField[] = [
	"name",
	"address",
	"category",
	"methods",
	"website",
	"contact",
];

export const firstInvalidField = (
	errors: DetailsErrors,
): DetailsField | undefined => firstInvalid(DETAILS_FIELDS, errors);

// The HTML spec's own "valid email address" rule — what the email input
// enforced before the form went `novalidate`.
const EMAIL_LOCAL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const EMAIL_DOMAIN =
	/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Browsers check an internationalized domain in its punycode form; the
// URL parser does that conversion. ASCII domains skip it, so its other
// normalizations (percent-decoding, IPv4 rewriting) can't widen the rule.
// Nor can its URL grammar: a port, path, query or fragment would be cut
// off, and a percent escape decoded, before the domain rule saw them.
const asciiDomain = (domain: string): string | null => {
	if (/^[\x21-\x7e]*$/.test(domain)) return domain;
	if (/[\s/\\:?#%]/.test(domain)) return null;
	try {
		return new URL(`http://${domain}`).hostname;
	} catch {
		return null;
	}
};

export const isValidEmail = (value: string): boolean => {
	const email = value.trim();
	const at = email.lastIndexOf("@");
	if (at <= 0) return false;
	const domain = asciiDomain(email.slice(at + 1));
	return (
		EMAIL_LOCAL.test(email.slice(0, at)) &&
		domain !== null &&
		EMAIL_DOMAIN.test(domain)
	);
};

// The website as it will be published: "" when left empty, null when it
// can't be read as a web address. A bare domain ("bitcoin.org") gets
// https:// in front; anything else must already be http(s). The typed
// text is kept otherwise — no trailing slash or case folding from the
// URL parser.
export const normalizeWebsite = (value: string): string | null => {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (/\s/.test(trimmed)) return null;
	const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed.replace(/^\/+/, "")}`;
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	// Credentials in a shop's website are a typo or a trick — and it's how
	// "mailto:a@b.com" parses once https:// goes in front.
	if (url.username || url.password) return null;
	const labels = url.hostname.split(".");
	if (labels.length < 2 || labels.some((label) => !label)) return null;
	return candidate;
};

export const validateDetails = (input: DetailsInput): DetailsErrors => {
	const errors: DetailsErrors = {};
	if (!input.name.trim()) errors.name = "required";
	if (input.addressRequired && !input.address.trim()) {
		errors.address = "required";
	}
	if (!input.category) {
		errors.category = "required";
	} else if (input.category === "Other" && !input.categoryOther.trim()) {
		errors.category = "otherRequired";
	}
	if (input.methods.length === 0) errors.methods = "required";
	if (normalizeWebsite(input.website) === null) errors.website = "invalid";
	if (input.contactRequired) {
		if (!input.contact.trim()) {
			errors.contact = "required";
		} else if (!isValidEmail(input.contact)) {
			errors.contact = "invalid";
		}
	}
	return errors;
};
