import type { GiteaIssue } from '$lib/types';
import type { PageServerLoad } from './$types';

type TicketsResponse = {
	issues: GiteaIssue[];
	totalCount: number;
	error?: string;
};

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/tickets?v=2');
		const data: TicketsResponse = await response.json();

		return {
			tickets: data.issues,
			totalTickets: data.totalCount
		};
	} catch (error) {
		console.error('Failed to fetch issues:', error);
		return {
			error: 'Could not load tickets',
			tickets: [],
			totalTickets: 0
		};
	}
};
