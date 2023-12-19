<script lang="ts">
	import { browser } from '$app/environment';
	import { DashboardStat, Footer, Header, HeaderPlaceholder } from '$lib/comp';
	import {
		areaError,
		areas,
		eventError,
		events,
		reportError,
		reports,
		syncStatus,
		theme
	} from '$lib/store';
	import type { ChartHistory, EventType, Report } from '$lib/types';
	import { detectTheme, errToast, updateChartThemes } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { format, startOfYear, subDays, subMonths, subYears } from 'date-fns';
	import { onMount } from 'svelte';

	// alert for event errors
	$: $eventError && errToast($eventError);

	// alert for area errors
	$: $areaError && errToast($areaError);

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

	$: communities =
		$areas && $areas.length && $reports && $reports.length
			? $areas.filter(
					(area) =>
						area.tags.type === 'community' &&
						((area.tags['box:east'] &&
							area.tags['box:north'] &&
							area.tags['box:south'] &&
							area.tags['box:west']) ||
							area.tags.geo_json) &&
						area.tags.name &&
						area.tags['icon:square'] &&
						area.tags.continent &&
						Object.keys(area.tags).find((key) => key.includes('contact')) &&
						$reports.find((report) => report.area_id === area.id)
				)
			: undefined;

	const getStatPeriod = () => {
		return new Date(new Date().getTime() - 24 * 60 * 60 * 1000).getTime();
	};

	const getStat = (stat: EventType) => {
		return $events.filter((event) => {
			let statPeriod = getStatPeriod();
			if (event.type === stat && Date.parse(event['created_at']) > statPeriod) {
				return true;
			} else {
				return false;
			}
		}).length;
	};

	const getStatPrevious = (stat: EventType) => {
		return $events.filter((event) => {
			let statPeriod = getStatPeriod();
			let previousStatPeriod = new Date(new Date().getTime() - 48 * 60 * 60 * 1000).getTime();
			if (
				event.type === stat &&
				Date.parse(event['created_at']) > previousStatPeriod &&
				Date.parse(event['created_at']) < statPeriod
			) {
				return true;
			} else {
				return false;
			}
		}).length;
	};

	$: total = stats && stats[0].tags.total_elements;

	$: created = $events && $events.length ? getStat('create') : undefined;
	$: createdPrevious = $events && $events.length ? getStatPrevious('create') : undefined;

	$: updated = $events && $events.length ? getStat('update') : undefined;
	$: updatedPrevious = $events && $events.length ? getStatPrevious('update') : undefined;

	$: deleted = $events && $events.length ? getStat('delete') : undefined;
	$: deletedPrevious = $events && $events.length ? getStatPrevious('delete') : undefined;

	$: onchain = stats && stats[0].tags.total_elements_onchain;
	$: lightning = stats && stats[0].tags.total_elements_lightning;
	$: nfc = stats && stats[0].tags.total_elements_lightning_contactless;

	$: totalChange =
		stats && total
			? new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
					total - stats[1].tags.total_elements
				)
			: undefined;

	$: createdPercentChange =
		created && createdPrevious
			? new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
					Number((((created - createdPrevious) / createdPrevious) * 100).toFixed(1))
				)
			: '';

	$: updatedPercentChange =
		updated && updatedPrevious
			? new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
					Number((((updated - updatedPrevious) / updatedPrevious) * 100).toFixed(1))
				)
			: '';

	$: deletedPercentChange =
		deleted && deletedPrevious
			? new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
					Number((((deleted - deletedPrevious) / deletedPrevious) * 100).toFixed(1))
				)
			: '';

	$: onchainPercentChange =
		stats && onchain
			? new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
					Number(
						(
							((onchain - stats[1].tags.total_elements_onchain) /
								stats[1].tags.total_elements_onchain) *
							100
						).toFixed(1)
					)
				)
			: '';

	$: lightningPercentChange =
		stats && lightning
			? new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
					Number(
						(
							((lightning - stats[1].tags.total_elements_lightning) /
								stats[1].tags.total_elements_lightning) *
							100
						).toFixed(1)
					)
				)
			: '';

	$: nfcPercentChange =
		stats && nfc
			? new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(
					Number(
						(
							((nfc - stats[1].tags.total_elements_lightning_contactless) /
								stats[1].tags.total_elements_lightning_contactless) *
							100
						).toFixed(1)
					)
				)
			: '';

	let upToDateChartCanvas: HTMLCanvasElement;
	let upToDateChart: Chart<'line', number[] | undefined, string>;
	let totalChartCanvas: HTMLCanvasElement;
	let totalChart: Chart<'line', number[] | undefined, string>;
	let legacyChartCanvas: HTMLCanvasElement;
	let legacyChart: Chart<'line', number[] | undefined, string>;
	let paymentMethodChartCanvas: HTMLCanvasElement;
	let paymentMethodChart: Chart<'line', number[] | undefined, string>;

	const populateCharts = () => {
		const theme = detectTheme();

		upToDateChart = new Chart(upToDateChartCanvas, {
			type: 'line',
			data: {
				labels: statsFiltered.map(({ date }) => date),
				datasets: [
					{
						label: 'Up-to-date Locations',
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

		legacyChart = new Chart(legacyChartCanvas, {
			type: 'line',
			data: {
				labels: statsFiltered.map(({ date }) => date),
				datasets: [
					{
						label: 'Legacy Locations',
						data: statsFiltered.map(({ tags: { legacy_elements } }) => legacy_elements),
						fill: {
							target: 'origin',
							above: 'rgba(235, 87, 87, 0.2)'
						},
						borderColor: 'rgb(235, 87, 87)',
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

		paymentMethodChart = new Chart(paymentMethodChartCanvas, {
			type: 'line',
			data: {
				labels: statsFiltered.map(({ date }) => date),
				datasets: [
					{
						label: 'On-chain',
						data: statsFiltered.map(
							({ tags: { total_elements_onchain } }) => total_elements_onchain
						),
						fill: false,
						borderColor: 'rgb(247, 147, 26)',
						tension: 0.1,
						pointStyle: false
					},
					{
						label: 'Lightning',
						data: statsFiltered.map(
							({ tags: { total_elements_lightning } }) => total_elements_lightning
						),
						fill: false,
						borderColor: 'rgb(249, 193, 50)',
						tension: 0.1,
						pointStyle: false
					},
					{
						label: 'Contactless',
						data: statsFiltered.map(
							({ tags: { total_elements_lightning_contactless } }) =>
								total_elements_lightning_contactless
						),
						fill: false,
						borderColor: 'rgb(102, 16, 242)',
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

				legacyChart.data.labels = statsFiltered.map(({ date }) => date);
				legacyChart.data.datasets[0].data = statsFiltered.map(
					({ tags: { legacy_elements } }) => legacy_elements
				);
				legacyChart.update();

				paymentMethodChart.data.labels = statsFiltered.map(({ date }) => date);
				paymentMethodChart.data.datasets[0].data = statsFiltered.map(
					({ tags: { total_elements_onchain } }) => total_elements_onchain
				);
				paymentMethodChart.data.datasets[1].data = statsFiltered.map(
					({ tags: { total_elements_lightning } }) => total_elements_lightning
				);
				paymentMethodChart.data.datasets[2].data = statsFiltered.map(
					({ tags: { total_elements_lightning_contactless } }) =>
						total_elements_lightning_contactless
				);
				paymentMethodChart.update();

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
		updateChartThemes([upToDateChart, totalChart, legacyChart, paymentMethodChart]);

	onMount(async () => {
		if (browser) {
			upToDateChartCanvas.getContext('2d');
			totalChartCanvas.getContext('2d');
			legacyChartCanvas.getContext('2d');
			paymentMethodChartCanvas.getContext('2d');

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

			<h2
				class="w-full text-center text-xl font-semibold text-primary dark:text-white md:text-left lg:w-[675px]"
			>
				Here are some stats and charts for the MATH nerds.
			</h2>

			<section id="stats">
				<div
					class="grid rounded-3xl border border-statBorder dark:bg-white/10 md:grid-cols-2 xl:grid-cols-4"
				>
					<DashboardStat
						title="Total Locations"
						stat={total}
						change={totalChange}
						border="border-b md:border-r border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Created in last 24 hours"
						stat={created}
						percent={createdPercentChange}
						border="border-b xl:border-r border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Updated in last 24 hours"
						stat={updated}
						percent={updatedPercentChange}
						border="border-b md:border-r border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Deleted in last 24 hours"
						stat={deleted}
						percent={deletedPercentChange}
						border="border-b border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Merchants accepting on-chain"
						stat={onchain}
						percent={onchainPercentChange}
						border="border-b xl:border-b-0 md:border-r border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Merchants accepting lightning"
						stat={lightning}
						percent={lightningPercentChange}
						border="border-b xl:border-b-0 xl:border-r border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Merchants accepting contactless"
						stat={nfc}
						percent={nfcPercentChange}
						border="border-b md:border-b-0 md:border-r border-statBorder"
						loading={$syncStatus && chartsRendered}
					/>
					<DashboardStat
						title="Number of communities"
						stat={communities && communities.length}
						loading={$syncStatus && chartsRendered}
					/>
				</div>
				<p class="text-center text-sm text-body dark:text-white md:text-left">
					*Data updated every 10 minutes, change based on previous 24 hours.
				</p>
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
						<canvas bind:this={totalChartCanvas} width="100%" height="400" />
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Elements accepting any bitcoin payment method.
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
						<canvas bind:this={legacyChartCanvas} width="100%" height="400" />
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Elements with a <em>payment:bitcoin</em> tag instead of the
						<em>currency:XBT</em> tag.
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
						<canvas bind:this={paymentMethodChartCanvas} width="100%" height="400" />
					</div>
					<p class="mt-1 text-center text-sm text-body dark:text-white">
						*Elements with <em>payment:onchain</em>, <em>payment:lightning</em> and
						<em>payment:lightning_contactless</em> tags.
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
