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
		},
	);

	return {
		...data,
		verifiedDate: tags["verified:date"],
		iconSquare: tags["icon:square"],
	};
};
