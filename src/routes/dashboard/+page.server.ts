import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const response = await fetch('https://api.btcmap.org/rpc', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'get_area_dashboard',
				params: {
					area_id: 662
				}
			})
		});

		const data = await response.json();

		if (data.error) {
			const errorMessage = data.error.message || 'RPC Error';
			const errorDetails = data.error.data ? `: ${JSON.stringify(data.error.data)}` : '';
			return {
				error: errorMessage + errorDetails,
				areaDashboard: null
			};
		}

		return {
			areaDashboard: data.result
		};
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : 'Failed to load dashboard data',
			areaDashboard: null
		};
	}
};
