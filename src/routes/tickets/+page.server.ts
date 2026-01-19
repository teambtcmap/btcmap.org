// Temporarily disabled during maintenance
// import { getIssues } from '$lib/gitea';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Temporarily disabled during maintenance
	// try {
	// 	const { issues, totalCount } = await getIssues();
	// 	return {
	// 		tickets: issues,
	// 		totalTickets: totalCount
	// 	};
	// } catch (error) {
	// 	console.error('Failed to fetch issues:', error);
	// 	return {
	// 		error: 'Could not load tickets',
	// 		tickets: [],
	// 		totalTickets: 0
	// 	};
	// }
	return {
		tickets: [],
		totalTickets: 0,
		maintenance: true
	};
};
