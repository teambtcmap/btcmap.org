import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

interface DashboardData {
	total_merchants: number;
	total_merchants_chart: Array<ChartEntry>;
	verified_merchants_1y: number;
	verified_merchants_1y_chart: Array<ChartEntry>;
	total_exchanges: number;
	verified_exchanges_1y: number;
}

interface ChartEntry {
	date: string;
	value: number;
}

export const load: PageServerLoad = async ({ fetch }) => {
	const response = await fetch('https://api.btcmap.org/v4/dashboard');

	if (!response.ok) {
		throw error(response.status, 'Failed to fetch dashboard data');
	}

	const areaDashboard: DashboardData = await response.json();

	return { areaDashboard };
};
