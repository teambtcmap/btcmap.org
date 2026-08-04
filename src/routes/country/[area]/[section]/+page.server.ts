import { loadAreaSection } from "$lib/areaSectionLoad";
import { validateContinents } from "$lib/utils";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { data } = await loadAreaSection(
		{ params, fetch },
		{
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
		},
	);

	return data;
};
