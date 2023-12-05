import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').LayoutServerLoad} */
// @ts-expect-error
export function load({ url }) {
	// redirect to communities map if params match
	const community = url.searchParams.get('community');
	const organization = url.searchParams.get('organization');
	const language = url.searchParams.get('language');
	const communitiesOnly = url.searchParams.has('communitiesOnly');

	switch (true) {
		case Boolean(community):
			throw redirect(301, `/communities/map?community=${community}`);

		case Boolean(organization):
			throw redirect(301, `/communities/map?organization=${organization}`);

		case Boolean(language):
			throw redirect(301, `/communities/map?language=${language}`);

		case communitiesOnly:
			throw redirect(301, '/communities/map');
	}
}
