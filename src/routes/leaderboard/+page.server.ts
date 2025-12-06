import type { PageServerLoad } from './$types';

const ALL_TIME_START = '2021-09-01';

const PERIOD_OPTIONS = ['3-months', '6-months', '12-months', 'all-time'] as const;

type PeriodKey = (typeof PERIOD_OPTIONS)[number];

type PeriodPreset =
	| {
			kind: 'relative';
			days: number;
	  }
	| {
			kind: 'fixed';
			startDate: string;
	  };

const PERIOD_PRESETS: Record<PeriodKey, PeriodPreset> = {
	'3-months': { kind: 'relative', days: 91 },
	'6-months': { kind: 'relative', days: 182 },
	'12-months': { kind: 'relative', days: 365 },
	'all-time': { kind: 'fixed', startDate: ALL_TIME_START }
};

const buildPeriodRange = (period: PeriodKey) => {
	const preset = PERIOD_PRESETS[period];
	const today = new Date();
	const period_end = today.toISOString().split('T')[0];
	if (preset.kind === 'fixed') {
		return { period_start: preset.startDate, period_end };
	}
	const startDate = new Date(today);
	startDate.setDate(startDate.getDate() - preset.days);
	return { period_start: startDate.toISOString().split('T')[0], period_end };
};

const DEFAULT_PERIOD: PeriodKey = '12-months';

const resolvePeriod = (maybePeriod: string | null): PeriodKey => {
	return PERIOD_OPTIONS.includes(maybePeriod as PeriodKey)
		? (maybePeriod as PeriodKey)
		: DEFAULT_PERIOD;
};

export const load: PageServerLoad = async ({ url }) => {
	const resolvedPeriod = resolvePeriod(url.searchParams.get('period'));
	const range = buildPeriodRange(resolvedPeriod);

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
					...range,
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
				rpcResult: null,
				period: resolvedPeriod,
				periodOptions: PERIOD_OPTIONS
			};
		}
		return {
			rpcResult: data.result,
			period: resolvedPeriod,
			periodOptions: PERIOD_OPTIONS
		};
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : 'Failed to load leaderboard',
			rpcResult: null,
			period: resolvedPeriod,
			periodOptions: PERIOD_OPTIONS
		};
	}
};
