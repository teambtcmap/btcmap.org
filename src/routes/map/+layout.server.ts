import { redirect } from "@sveltejs/kit";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ url }) => {
	// redirect to communities map if params match
	const community = url.searchParams.get("community");
	const organization = url.searchParams.get("organization");
	const language = url.searchParams.get("language");
	const communitiesOnly = url.searchParams.has("communitiesOnly");

	switch (true) {
		case Boolean(community):
			redirect(301, `/communities/map?community=${community}`);
			break;

		case Boolean(organization):
			redirect(301, `/communities/map?organization=${organization}`);
			break;

		case Boolean(language):
			redirect(301, `/communities/map?language=${language}`);
			break;

		case communitiesOnly:
			url.searchParams.delete("communitiesOnly");
			redirect(301, "/communities/map");
			break;
	}
};
