import { json } from '@sveltejs/kit';
import { getIssues } from '$lib/gitea';

export async function GET() {
  const { issues, totalCount } = await getIssues();
  return json({ tickets: issues, totalTickets: totalCount });
}