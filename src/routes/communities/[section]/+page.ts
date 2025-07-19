import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const { section } = params;
	
	// Define valid continent sections
	const validContinents = [
		'africa', 
		'asia', 
		'europe', 
		'north-america', 
		'oceania', 
		'south-america'
	];
	
	// For now, we'll accept any section that's not a continent as a potential organization
	// The actual validation will happen client-side once organization data is loaded
	// This allows for dynamic organization sections
	
	// If section is not a valid continent, we'll pass it through
	// and let the client-side handle organization validation
	if (!validContinents.includes(section)) {
		// This could be an organization section - validate client-side
		return {
			section,
			isOrganization: true
		};
	}
	
	return {
		section,
		isOrganization: false
	};
};