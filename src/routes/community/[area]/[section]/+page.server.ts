import { loadAreaSection } from "$lib/areaSectionLoad";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { data, tags } = await loadAreaSection(
		{ params, fetch },
		{
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
		},
	);

	return {
		...data,
		verifiedDate: tags["verified:date"],
		iconSquare: tags["icon:square"],
	};
};
