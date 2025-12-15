import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const { area } = params;
	// Redirect to default merchants section
	throw redirect(302, `/community/${area}/merchants`);
};
