
import { getIssues } from '$lib/gitea';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  try {
    const { issues, totalCount } = await getIssues();
    return {
      tickets: issues,
      totalTickets: totalCount
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
