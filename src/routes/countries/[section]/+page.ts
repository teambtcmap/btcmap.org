import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const { section } = params;
	const validSections = ['africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america'];

	// If invalid section, redirect to Africa
	if (!validSections.includes(section)) {
		throw redirect(302, '/countries/africa');
	}

	return {
		section
	};
};
