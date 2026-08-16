import type { AreaSectionConfig, AreaSectionEvent } from "$lib/areaSectionLoad";
import { loadAreaSection } from "$lib/areaSectionLoad";
import { validateContinents } from "$lib/utils";

export const communityAreaConfig: AreaSectionConfig = {
	notFoundMessage: "Community Not Found",
	redirectBase: "/community",
	// Allow non-Latin aliases while still rejecting malformed path-like values.
	isValidArea: (area) => !area.includes("/"),
	// The tags AreaPage renders from — previously enforced client-side
	// via the $areas-lookup filter.
	hasRequiredTags: (tags) =>
		tags.type === "community" &&
		!!tags.geo_json &&
		!!tags.name &&
		!!tags["icon:square"] &&
		!!tags.continent,
};

export const countryAreaConfig: AreaSectionConfig = {
	notFoundMessage: "Country Not Found",
	redirectBase: "/country",
	// Alphanumeric, underscores, and hyphens only.
	isValidArea: (area) => /^[\w-]+$/.test(area),
	// The tags AreaPage renders from — previously enforced client-side
	// via the $areas-lookup filter. (The old lookup's two-letter-id
	// disambiguation is obsolete: the v3 slug fetch resolves directly.)
	hasRequiredTags: (tags) =>
		tags.type === "country" &&
		!!tags.geo_json &&
		!!tags.name &&
		!!tags.continent &&
		validateContinents(tags.continent),
};

// The eight literal section loaders differ only in type and section —
// these two helpers keep them one-liners. Community additionally lifts
// verifiedDate/iconSquare out of tags (both optional on AreaPageProps).
export const loadCommunityArea = async (
	event: AreaSectionEvent,
	section: string,
) => {
	const { data, tags } = await loadAreaSection(
		event,
		communityAreaConfig,
		section,
	);
	return {
		...data,
		verifiedDate: tags["verified:date"],
		iconSquare: tags["icon:square"],
	};
};

export const loadCountryArea = async (
	event: AreaSectionEvent,
	section: string,
) => {
	const { data } = await loadAreaSection(event, countryAreaConfig, section);
	return data;
};
