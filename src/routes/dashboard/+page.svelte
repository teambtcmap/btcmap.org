<script lang="ts">
	import { browser } from '$app/environment';
	import { DashboardStat, Footer, Header, HeaderPlaceholder } from '$lib/comp';
	import { eventError, reportError, reports, syncStatus, theme } from '$lib/store';
	import type { ChartHistory, Report } from '$lib/types';
	import { detectTheme, errToast, updateChartThemes } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { format, startOfYear, subDays, subMonths, subYears } from 'date-fns';
	import { onMount } from 'svelte';

	// alert for event errors
	$: $eventError && errToast($eventError);

	// alert for report errors
	$: $reportError && errToast($reportError);

	let chartsLoading = true;
	let chartsRendered = false;
	let initialRenderComplete = false;

	$: stats =
		$reports && $reports.length
			? $reports
					.filter((report) => report['area_id'] === '')
					.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
			: undefined;

	const chartHistory: ChartHistory[] = ['7D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
	let chartHistorySelected: ChartHistory = '3M';
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
				return new Date('2022-10-29T00:00:00.000Z');
		}
	};

	$: statsSorted = stats
		? [...stats]
				.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
				.map((stat) => ({ ...stat, date: format(new Date(stat.created_at), 'yyyy-MM-dd') }))
		: [];
	$: statsFiltered =
		statsSorted && chartHistorySelected
			? statsSorted.filter((stat) => {
					if (chartHistorySelected === 'ALL') return true;

					const dateHistory = getChartHistoryDate();

					if (new Date(stat.created_at) >= dateHistory) {
						return true;
					} else {
						return false;
					}
				})
			: [];

	$: total = stats && stats[0].tags.total_elements;
	$: recently_verified = stats && stats[0].tags.up_to_date_elements;

	let upToDateChartCanvas: HTMLCanvasElement;
	let upToDateChart: Chart<'line', number[] | undefined, string>;
	let totalChartCanvas: HTMLCanvasElement;
	let totalChart: Chart<'line', number[] | undefined, string>;
	let daysSinceVerifiedChartCanvas: HTMLCanvasElement;
	let daysSinceVerifiedChart: Chart<'line', number[] | undefined, string>;

	const getDaysSinceVerified = (report: Report): number => {
		const reportDate = new Date(report.created_at);
		const avgVerificationDate = new Date(report.tags.avg_verification_date);
		const diff = Math.abs(reportDate.getTime() - avgVerificationDate.getTime());
		const diffDays = Math.ceil(diff / (1000 * 3600 * 24));
		return diffDays;
	};

	const populateCharts = () => {
		const theme = detectTheme();

		upToDateChart = new Chart(upToDateChartCanvas, {
			type: 'line',
			data: {
				labels: statsFiltered.map(({ date }) => date),
				datasets: [
					{
						label: 'Recently Verified Locations',
						data: statsFiltered.map(({ tags: { up_to_date_elements } }) => up_to_date_elements),
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
				labels: statsFiltered.map(({ date }) => date),
				datasets: [
					{
						label: 'Total Locations',
						data: statsFiltered.map((stat) => {
							switch (stat.id) {
								case 60675:
									return 7886;
								case 61063:
									return 7895;
								case 61459:
									return 7897;
								case 61855:
									return 7903;
								case 62251:
									return 7905;
								default:
									return stat.tags.total_elements;
							}
						}),
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
				labels: statsFiltered.map(({ date }) => date),
				datasets: [
					{
						label: 'Average Last Verification Age',
						data: statsFiltered.map((stat) => getDaysSinceVerified(stat)),
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

		chartsLoading = false;
		chartsRendered = true;
	};

	const chartSync = (status: boolean, reports: Report[]) => {
		if (reports.length && !status && initialRenderComplete) {
			chartsLoading = true;

			const today = new Date();

			if (statsFiltered.length) {
				const latestReport = statsFiltered[statsFiltered.length - 1];
				const latestReportDate = new Date(latestReport.created_at);
				const reportIsCurrent =
					today.getDate() === latestReportDate.getDate() &&
					today.getMonth() === latestReportDate.getMonth() &&
					today.getFullYear() === latestReportDate.getFullYear();

				if (!reportIsCurrent) {
					statsFiltered.push({
						...latestReport,
						id: latestReport.id + 1,
						date: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
						created_at: today.toISOString(),
						updated_at: today.toISOString()
					});

					statsFiltered = statsFiltered;
				}
			} else {
				const latestReport = statsSorted[statsSorted.length - 1];
				const dateHistory = getChartHistoryDate();
				const reportIsCurrent =
					today.getDate() === dateHistory.getDate() &&
					today.getMonth() === dateHistory.getMonth() &&
					today.getFullYear() === dateHistory.getFullYear();

				statsFiltered.push({
					...latestReport,
					date: `${dateHistory.getFullYear()}-${
						dateHistory.getMonth() + 1
					}-${dateHistory.getDate()}`,
					created_at: dateHistory.toISOString(),
					updated_at: dateHistory.toISOString()
				});

				if (!reportIsCurrent) {
					statsFiltered.push({
						...latestReport,
						id: latestReport.id + 1,
						date: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
						created_at: today.toISOString(),
						updated_at: today.toISOString()
					});
				}

				statsFiltered = statsFiltered;
			}

			if (chartsRendered) {
				upToDateChart.data.labels = statsFiltered.map(({ date }) => date);
				upToDateChart.data.datasets[0].data = statsFiltered.map(
					({ tags: { up_to_date_elements } }) => up_to_date_elements
				);
				upToDateChart.update();

				totalChart.data.labels = statsFiltered.map(({ date }) => date);
				totalChart.data.datasets[0].data = statsFiltered.map((stat) => {
					switch (stat.id) {
						case 60675:
							return 7886;
						case 61063:
							return 7895;
						case 61459:
							return 7897;
						case 61855:
							return 7903;
						case 62251:
							return 7905;
						default:
							return stat.tags.total_elements;
					}
				});
				totalChart.update();

				daysSinceVerifiedChart.data.labels = statsFiltered.map(({ date }) => date);
				daysSinceVerifiedChart.data.datasets[0].data = statsFiltered.map((stat) =>
					getDaysSinceVerified(stat)
				);
				daysSinceVerifiedChart.update();

				chartsLoading = false;
			} else {
				populateCharts();
			}
		}
	};

	$: chartHistorySelected && chartSync($syncStatus, $reports);

	$: $theme !== undefined &&
		chartsLoading === false &&
		chartsRendered === true &&
		updateChartThemes([upToDateChart, totalChart, daysSinceVerifiedChart]);

	onMount(async () => {
		if (browser) {
			upToDateChartCanvas.getContext('2d');
			totalChartCanvas.getContext('2d');
			daysSinceVerifiedChartCanvas.getContext('2d');

			if ($reports && $reports.length) {
				populateCharts();
			}

			initialRenderComplete = true;
		}
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

			<section id="stats">
				<div
					class="grid rounded-3xl border border-statBorder dark:bg-white/10 md:grid-cols-2 xl:grid-cols-2"
				>
					<DashboardStat
						title="Total Locations"
						stat={total}
						border="md:border-r border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Recetnly Verified Locations"
						stat={recently_verified}
						loading={$syncStatus && chartsRendered}
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
							on:click={() => (chartHistorySelected = history)}
							disabled={chartsLoading}
						>
							{history}
						</button>
					{/each}
				</div>

				<div>
					<div class="relative">
						{#if chartsLoading}
							<div
								class="absolute left-0 top-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
							>
								<i class="fa-solid fa-chart-area h-24 w-24 animate-pulse text-link/50" />
							</div>
						{/if}
						<canvas bind:this={totalChartCanvas} width="100%" height="400" />
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Elements accepting any bitcoin method.
					</p>
				</div>

				<div>
					<div class="relative">
						{#if chartsLoading}
							<div
								class="absolute left-0 top-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
							>
								<i class="fa-solid fa-chart-area h-24 w-24 animate-pulse text-link/50" />
							</div>
						{/if}
						<canvas bind:this={upToDateChartCanvas} width="100%" height="400" />
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Elements with a <em>survey:date</em>, <em>check_date</em>, or
						<em>check_date:currency:XBT</em> tag less than one year old.
					</p>
				</div>

				<div>
					<div class="relative">
						{#if chartsLoading}
							<div
								class="absolute left-0 top-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
							>
								<i class="fa-solid fa-chart-area h-24 w-24 animate-pulse text-link/50" />
							</div>
						{/if}
						<canvas bind:this={daysSinceVerifiedChartCanvas} width="100%" height="400" />
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
