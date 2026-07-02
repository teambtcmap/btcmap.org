import { loadAreaSection } from "$lib/areaSectionLoad";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { data } = await loadAreaSection(
		{ params, fetch },
		{
			notFoundMessage: "Country Not Found",
			redirectBase: "/country",
			// Alphanumeric, underscores, and hyphens only.
			isValidArea: (area) => /^[\w-]+$/.test(area),
		},
	);

	return data;
};
