import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const { area, section } = params;
	const validSections = ['merchants', 'stats', 'activity', 'maintain'];
	
	// If invalid section, redirect to merchants
	if (!validSections.includes(section)) {
		throw redirect(302, `/country/${area}/merchants`);
	}
	
	return {
		area,
		section
	};
};