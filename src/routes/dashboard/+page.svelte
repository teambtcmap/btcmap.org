<script lang="ts">
	import { run } from 'svelte/legacy';

	import { browser } from '$app/environment';
	import { DashboardStat, Footer, Header, HeaderPlaceholder } from '$lib/comp';
	import { theme } from '$lib/store';
	import type { ChartHistory } from '$lib/types';
	import { detectTheme, updateChartThemes } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { format, startOfYear, subDays, subMonths, subYears } from 'date-fns';
	import { onMount } from 'svelte';

	let { data } = $props();

	let areaDashboard = $state(data.areaDashboard);
	let error = $state(data.error);

	const chartHistory: ChartHistory[] = ['7D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
	let chartHistorySelected: ChartHistory = $state('3M');

	let upToDateChartCanvas: HTMLCanvasElement = $state();
	let upToDateChart: Chart<'line', number[], string> = $state();
	let totalChartCanvas: HTMLCanvasElement = $state();
	let totalChart: Chart<'line', number[], string> = $state();
	let daysSinceVerifiedChartCanvas: HTMLCanvasElement = $state();
	let daysSinceVerifiedChart: Chart<'line', number[], string> = $state();

	const populateCharts = () => {
		const theme = detectTheme();
		const cutoffDate = getChartHistoryDate();

		const filterData = (data: ChartDataItem[] = []) =>
			data.filter((item) => new Date(item.date) >= cutoffDate);

		upToDateChart = new Chart(upToDateChartCanvas, {
			type: 'line',
			data: {
				labels: filterData(areaDashboard?.verified_elements_365d_chart || [])
					.map((item) => format(new Date(item.date), 'yyyy-MM-dd'))
					.reverse(),
				datasets: [
					{
						label: 'Recently Verified Locations',
						data: filterData(areaDashboard?.verified_elements_365d_chart || [])
							.map((item) => item.value)
							.reverse(),
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
				labels: filterData(areaDashboard?.total_elements_chart || [])
					.map((item) => format(new Date(item.date), 'yyyy-MM-dd'))
					.reverse(),
				datasets: [
					{
						label: 'Total Locations',
						data: filterData(areaDashboard?.total_elements_chart || [])
							.map((item) => item.value)
							.reverse(),
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

		daysSinceVerifiedChart = new Chart(daysSinceVerifiedChartCanvas, {
			type: 'line',
			data: {
				labels: filterData(areaDashboard?.days_since_verified_chart || [])
					.map((item) => format(new Date(item.date), 'yyyy-MM-dd'))
					.reverse(),
				datasets: [
					{
						label: 'Average Last Verification Age',
						data: filterData(areaDashboard?.days_since_verified_chart || [])
							.map((item) => item.value)
							.reverse(),
						fill: {
							target: 'origin',
							above: 'rgba(247, 147, 26, 0.3)'
						},
						borderColor: 'rgb(247, 147, 26)',
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

	run(() => {
		$theme !== undefined && updateChartThemes([upToDateChart, totalChart, daysSinceVerifiedChart]);
	});

	onMount(async () => {
		if (browser) {
			upToDateChartCanvas.getContext('2d');
			totalChartCanvas.getContext('2d');
			daysSinceVerifiedChartCanvas.getContext('2d');
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

	run(() => {
		if (chartHistorySelected && upToDateChart && totalChart && daysSinceVerifiedChart) {
			const cutoffDate = getChartHistoryDate();

			const filterData = (data: ChartDataItem[] = []) =>
				data.filter((item) => new Date(item.date) >= cutoffDate);

			const updateChart = (chart: Chart<'line', number[], string>, data: ChartDataItem[]) => {
				const filtered = filterData(data);
				chart.data.labels = filtered
					.map((item) => format(new Date(item.date), 'yyyy-MM-dd'))
					.reverse();
				chart.data.datasets[0].data = filtered.map((item) => item.value).reverse();
				chart.update();
			};

			updateChart(upToDateChart, areaDashboard?.verified_elements_365d_chart || []);
			updateChart(totalChart, areaDashboard?.total_elements_chart || []);
			updateChart(daysSinceVerifiedChart, areaDashboard?.days_since_verified_chart || []);
		}
	});

	run(() => {
		areaDashboard = data.areaDashboard;
		error = data.error;
	});
</script>

<svelte:head>
	<title>BTC Map - Dashboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/dash.png" />
	<meta property="twitter:title" content="BTC Map - Dashboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/dash.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="mb-20 mt-10 space-y-10">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-center text-4xl font-semibold !leading-tight md:text-left md:text-5xl"
				>
					Dashboard
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			{#if error}
				<div class="rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
					<p>Error loading dashboard data: {error}</p>
				</div>
			{/if}

			<section id="stats">
				<div
					class="grid rounded-3xl border border-statBorder dark:bg-white/10 md:grid-cols-2 xl:grid-cols-2"
				>
					<DashboardStat
						title="Total Locations"
						stat={areaDashboard?.total_elements}
						border="md:border-r border-statBorder"
						loading={false}
					/>
					<DashboardStat
						title="Recently Verified Locations"
						stat={areaDashboard?.verified_elements_365d}
						loading={false}
					/>
				</div>
			</section>

			<section id="charts" class="space-y-10">
				<div
					class="flex flex-wrap justify-end gap-3 font-semibold text-primary dark:text-white md:gap-5"
				>
					{#each chartHistory as history}
						<button
							class={chartHistorySelected === history
								? 'underline decoration-primary decoration-4 underline-offset-8 dark:decoration-white'
								: ''}
							onclick={() => (chartHistorySelected = history)}
						>
							{history}
						</button>
					{/each}
				</div>

				<div>
					<div class="relative">
						<canvas bind:this={totalChartCanvas} width="100%" height="400"></canvas>
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Elements accepting any bitcoin method.
					</p>
				</div>

				<div>
					<div class="relative">
						<canvas bind:this={upToDateChartCanvas} width="100%" height="400"></canvas>
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Elements with a <em>survey:date</em>, <em>check_date</em>, or
						<em>check_date:currency:XBT</em> tag less than one year old.
					</p>
				</div>

				<div>
					<div class="relative">
						<canvas bind:this={daysSinceVerifiedChartCanvas} width="100%" height="400"></canvas>
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Based on <em>survey:date</em>, <em>check_date</em>, or
						<em>check_date:currency:XBT</em>.
					</p>
				</div>
			</section>

			<p class="text-center text-sm text-body dark:text-white md:text-left">
				*More information on bitcoin mapping tags can be found <a
					href="https://wiki.btcmap.org/general/tagging-instructions.html#tagging-guidance"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">here</a
				>.
			</p>
		</main>

		<Footer />
	</div>
</div>
