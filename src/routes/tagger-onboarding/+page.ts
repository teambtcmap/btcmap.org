import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

// The application form is retired (#1376): the guide IS the onboarding,
// the form was a gate. This route survives only as a courtesy to old
// links. Permanent, so crawlers and bookmarks move on. Universal load —
// SSR and client-side navigations redirect alike.
export const load: PageLoad = () => {
	redirect(301, "/join-us");
};
