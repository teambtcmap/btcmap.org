import type { PageServerLoad } from './$types';

const excludeLeader = [
	2104834, 9451067, 1722488, 81735, 18545877, 232801, 19880430, 1778799, 21749653, 6816132
];

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
        // Filter out excluded users server-side
        const filteredUsers = (data.result.users as Array<{ id: number }>).filter((user) => !excludeLeader.includes(user.id));

		return {
			rpcResult: {
				...data.result,
				users: filteredUsers
			}
		};
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : 'Failed to load leaderboard',
			rpcResult: null
		};
	}
};
