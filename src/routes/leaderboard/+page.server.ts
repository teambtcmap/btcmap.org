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
				method: 'get_most_active_users',
				params: {
					period_start: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
						.toISOString()
						.split('T')[0],
					period_end: new Date().toISOString().split('T')[0],
					limit: 50
				}
			})
		});

		const data = await response.json();

		if (data.error) {
			const errorMessage = data.error.message || 'RPC Error';
			const errorDetails = data.error.data ? `: ${JSON.stringify(data.error.data)}` : '';
			return {
				error: errorMessage + errorDetails,
				rpcResult: null
			};
		}
		return {
			rpcResult: data.result
		};
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : 'Failed to load leaderboard',
			rpcResult: null
		};
	}
};
