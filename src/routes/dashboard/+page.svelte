<script lang="ts">
	import { browser } from '$app/environment';
	import DashboardStat from './components/DashboardStat.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import { theme } from '$lib/store';
	import type { ChartHistory } from '$lib/types';
	import { detectTheme, updateChartThemes } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { format, startOfYear, subDays, subMonths, subYears } from 'date-fns';
	import { onMount } from 'svelte';

	export let data;

	let areaDashboard = data.areaDashboard;

	const chartHistory: ChartHistory[] = ['7D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
	let chartHistorySelected: ChartHistory = '3M';

	let totalChartCanvas: HTMLCanvasElement;
	let totalChart: Chart<'line', number[], string>;

	let upToDateChartCanvas: HTMLCanvasElement;
	let upToDateChart: Chart<'line', number[], string>;

	const populateCharts = () => {
		const theme = detectTheme();
		const cutoffDate = getChartHistoryDate();

		const filterData = (data: ChartDataItem[] = []) =>
			data.filter((item) => new Date(item.date) >= cutoffDate);

		upToDateChart = new Chart(upToDateChartCanvas, {
			type: 'line',
			data: {
				labels: filterData(areaDashboard?.verified_merchants_1y_chart || []).map((item) =>
					format(new Date(item.date), 'yyyy-MM-dd')
				),
				datasets: [
					{
						label: 'Recently Verified Merchants',
						data: filterData(areaDashboard?.verified_merchants_1y_chart || []).map(
							(item) => item.value
						),
						fill: {
							target: 'origin',
							above: 'rgba(11, 144, 114, 0.2)'
						},
						borderColor: 'rgb(11, 144, 114)',
						tension: 0.1,
						pointStyle: false
					}
				]
			},
			options: {
				animation: false,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							font: {
								weight: 600
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							maxTicksLimit: 5,
							font: {
								weight: 600
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					},
					y: {
						ticks: {
							font: {
								weight: 600
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					}
				},
				interaction: {
					intersect: false
				}
			}
		});

		totalChart = new Chart(totalChartCanvas, {
			type: 'line',
			data: {
				labels: filterData(areaDashboard?.total_merchants_chart || []).map((item) =>
					format(new Date(item.date), 'yyyy-MM-dd')
				),
				datasets: [
					{
						label: 'Total Merchants',
						data: filterData(areaDashboard?.total_merchants_chart || []).map((item) => item.value),
						fill: {
							target: 'origin',
							above: 'rgba(0, 153, 175, 0.2)'
						},
						borderColor: 'rgb(0, 153, 175)',
						tension: 0.1,
						pointStyle: false
					}
				]
			},
			options: {
				animation: false,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							font: {
								weight: 600
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							maxTicksLimit: 5,
							font: {
								weight: 600
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					},
					y: {
						ticks: {
							font: {
								weight: 600
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					}
				},
				interaction: {
					intersect: false
				}
			}
		});
	};

	$: $theme !== undefined && updateChartThemes([upToDateChart, totalChart]);

	onMount(async () => {
		if (browser) {
			upToDateChartCanvas.getContext('2d');
			totalChartCanvas.getContext('2d');
			populateCharts();
		}
	});

	interface ChartDataItem {
		date: string;
		value: number;
	}

	const getChartHistoryDate = () => {
		const today = new Date();
		switch (chartHistorySelected) {
			case '7D':
				return subDays(today, 7);
			case '1M':
				return subMonths(today, 1);
			case '3M':
				return subMonths(today, 3);
			case '6M':
				return subMonths(today, 6);
			case 'YTD':
				return startOfYear(today);
			case '1Y':
				return subYears(today, 1);
			case 'ALL':
				return new Date(0);
		}
	};

	$: {
		if (chartHistorySelected && upToDateChart && totalChart) {
			const cutoffDate = getChartHistoryDate();

			const filterData = (data: ChartDataItem[] = []) =>
				data.filter((item) => new Date(item.date) >= cutoffDate);

			const updateChart = (chart: Chart<'line', number[], string>, data: ChartDataItem[]) => {
				const filtered = filterData(data);
				chart.data.labels = filtered.map((item) => format(new Date(item.date), 'yyyy-MM-dd'));
				chart.data.datasets[0].data = filtered.map((item) => item.value);
				chart.update();
			};

			updateChart(upToDateChart, areaDashboard?.verified_merchants_1y_chart || []);
			updateChart(totalChart, areaDashboard?.total_merchants_chart || []);
		}
	}

	$: {
		areaDashboard = data.areaDashboard;
	}
</script>

<svelte:head>
	<title>BTC Map - Dashboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/dash.png" />
	<meta property="twitter:title" content="BTC Map - Dashboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/dash.png" />
</svelte:head>

<main class="mt-10 mb-20 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-left md:text-5xl"
		>
			Dashboard
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<section id="merchant-stats">
		<div
			class="grid rounded-3xl border border-gray-200 md:grid-cols-2 xl:grid-cols-2 dark:border-white/95 dark:bg-white/10"
		>
			<DashboardStat
				title="Total Merchants"
				stat={areaDashboard?.total_merchants}
				border="border-b md:border-b-0 border-gray-300"
				loading={false}
			/>
			<DashboardStat
				title="Recently Verified"
				stat={areaDashboard?.verified_merchants_1y}
				loading={false}
			/>
		</div>
	</section>

	<section id="exchange-stats">
		<div
			class="grid rounded-3xl border border-gray-300 md:grid-cols-2 xl:grid-cols-2 dark:border-white/95 dark:bg-white/10"
		>
			<DashboardStat
				title="Total Exchanges"
				stat={areaDashboard?.total_exchanges}
				border="border-b md:border-b-0 border-gray-300"
				loading={false}
			/>
			<DashboardStat
				title="Recently Verified"
				stat={areaDashboard?.verified_exchanges_1y}
				loading={false}
			/>
		</div>
	</section>

	<section id="charts" class="space-y-10">
		<div
			class="flex flex-wrap justify-end gap-3 font-semibold text-primary md:gap-5 dark:text-white"
		>
			{#each chartHistory as history (history)}
				<button
					class={chartHistorySelected === history
						? 'underline decoration-primary decoration-4 underline-offset-8 dark:decoration-white'
						: ''}
					on:click={() => (chartHistorySelected = history)}
				>
					{history}
				</button>
			{/each}
		</div>

		<div>
			<div class="relative">
				<canvas bind:this={totalChartCanvas} width="100%" height="400" />
			</div>
			<p class="mt-1 text-center text-sm text-body dark:text-white">
				*Merchants accepting any bitcoin method.
			</p>
		</div>

		<div>
			<div class="relative">
				<canvas bind:this={upToDateChartCanvas} width="100%" height="400" />
			</div>
			<p class="mt-1 text-center text-sm text-body dark:text-white">
				*Merchants with a <em>survey:date</em>, <em>check_date</em>, or
				<em>check_date:currency:XBT</em> tag less than one year old.
			</p>
		</div>
	</section>

	<p class="text-center text-sm text-body md:text-left dark:text-white">
		*More information on bitcoin mapping tags can be found <a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#tagging-guidance"
			target="_blank"
			rel="noreferrer"
			class="text-link transition-colors hover:text-hover">here</a
		>.
	</p>
</main>
