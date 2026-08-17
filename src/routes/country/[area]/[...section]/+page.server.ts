import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

// Unknown sections 302 to /merchants — parity with the old
// VALID_SECTIONS redirect in loadAreaSection. Literal section routes
// outrank this rest-param route, so it only sees genuinely bogus paths.
export const load: PageServerLoad = async ({ params }) => {
	throw redirect(302, `/country/${encodeURIComponent(params.area)}/merchants`);
};
