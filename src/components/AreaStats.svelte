<script lang="ts">
	import { browser } from '$app/environment';
	import Icon from '$components/Icon.svelte';
	import ProfileStat from '$components/ProfileStat.svelte';
	import { calcVerifiedDate, verifiedArr } from '$lib/map/setup';
	import { theme } from '$lib/store';
	import { type Place, type Report, type AreaTags } from '$lib/types.js';
	import { detectTheme, updateChartThemes } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { onMount } from 'svelte';

	export let name: string;
	export let filteredPlaces: Place[];
	export let areaReports: Report[];
	export let areaTags: AreaTags | undefined = undefined;

	const getPopulationDate = (tags: AreaTags | undefined): string | undefined => {
		if (!tags) return undefined;
		// Prefer population:date over population:year, convert year to string if needed
		return (
			tags['population:date'] ||
			(tags['population:year'] ? String(tags['population:year']) : undefined)
		);
	};

	let initialRenderComplete = false;
	let dataInitialized = false;

	const initializeData = () => {
		if (dataInitialized) return;

		filteredPlaces.forEach((place) => {
			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();
			let verified = verifiedArr(place);

			if (verified.length && Date.parse(verified[0]) > verifiedDate) {
				if (upToDate === undefined) {
					upToDate = 1;
				} else {
					upToDate++;
				}
			} else {
				if (outdated === undefined) {
					outdated = 1;
				} else {
					outdated++;
				}
			}

			if (place['osm:payment:bitcoin']) {
				if (legacy === undefined) {
					legacy = 1;
				} else {
					legacy++;
				}
			}

			if (total === undefined) {
				total = 1;
			} else {
				total++;
			}
		});

		if (!upToDate) {
			upToDate = 0;
		}

		if (!outdated) {
			outdated = 0;
		}

		if (!legacy) {
			legacy = 0;
		}

		if (!total) {
			total = 0;
		}

		upToDatePercent = upToDate ? (upToDate / (total / 100)).toFixed(0) : '0';

		const populateCharts = () => {
			const chartsReports = [...areaReports].sort(
				(a, b) => Date.parse(a['created_at']) - Date.parse(b['created_at'])
			);

			const today = new Date();
			const latestReport = chartsReports[chartsReports.length - 1];
			const latestReportDate = new Date(latestReport.created_at);
			const reportIsCurrent =
				today.getDate() === latestReportDate.getDate() &&
				today.getMonth() === latestReportDate.getMonth() &&
				today.getFullYear() === latestReportDate.getFullYear();

			if (!reportIsCurrent) {
				chartsReports.push({
					...latestReport,
					id: latestReport.id + 1,
					date: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
					created_at: today.toISOString(),
					updated_at: today.toISOString()
				});
			}

			const theme = detectTheme();

			updatedChart = new Chart(updatedChartCanvas, {
				type: 'pie',
				data: {
					labels: ['Recently Verified', 'Outdated'],
					datasets: [
						{
							label: 'Locations',
							data: [upToDate, outdated],
							backgroundColor: ['rgb(16, 183, 145)', 'rgb(235, 87, 87)'],
							hoverOffset: 4
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
					}
				}
			});

			let percents = chartsReports.filter((report) => report.tags.up_to_date_percent);

			upToDateChart = new Chart(upToDateChartCanvas, {
				type: 'line',
				data: {
					labels: percents.map(({ date }) => date),
					datasets: [
						{
							label: 'Recently Verified Percent',
							data: percents.map(({ tags: { up_to_date_percent } }) => up_to_date_percent),
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
							min: 0,
							max: 100,
							ticks: {
								precision: 0,
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
					labels: chartsReports.map(({ date }) => date),
					datasets: [
						{
							label: 'Total Locations',
							data: chartsReports.map(({ tags: { total_elements } }) => total_elements),
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
							min: 0,
							grace: '5%',
							ticks: {
								precision: 0,
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
		};

		populateCharts();

		dataInitialized = true;
	};

	// Check if places have verification data (indicator that enrichment is complete)
	$: hasVerificationData =
		filteredPlaces &&
		filteredPlaces.length > 0 &&
		filteredPlaces.some(
			(p) => p['osm:survey:date'] || p['osm:check_date'] || p['osm:check_date:currency:XBT']
		);

	// Only initialize when we have verification data
	$: hasVerificationData &&
		areaReports &&
		initialRenderComplete &&
		!dataInitialized &&
		initializeData();

	let total: number | undefined;
	let upToDate: number | undefined;
	let outdated: number | undefined;
	let legacy: number | undefined;

	let upToDatePercent: string | undefined;

	let updatedChartCanvas: HTMLCanvasElement;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let updatedChart;

	let chartsLoading = true;
	let upToDateChartCanvas: HTMLCanvasElement;
	let upToDateChart: Chart<'line', number[], string>;
	let totalChartCanvas: HTMLCanvasElement;
	let totalChart: Chart<'line', number[], string>;

	$: $theme !== undefined && !chartsLoading && updateChartThemes([upToDateChart, totalChart]);

	onMount(async () => {
		if (browser) {
			// setup charts
			updatedChartCanvas.getContext('2d');
			upToDateChartCanvas.getContext('2d');
			totalChartCanvas.getContext('2d');

			initialRenderComplete = true;
		}
	});
</script>

<section id="stats">
	{#if areaTags && (areaTags.population || areaTags.area_km2)}
		<div
			class="mb-5 grid gap-4 rounded-3xl border border-gray-300 p-6 md:grid-cols-2 dark:border-white/95 dark:bg-white/10"
		>
			{#if areaTags.population}
				<div class="flex flex-col">
					<span class="text-sm tracking-wide text-gray-600 uppercase dark:text-gray-300"
						>Population</span
					>
					<span class="text-2xl font-bold text-primary dark:text-white">
						{parseInt(areaTags.population).toLocaleString()}
					</span>
					{#if getPopulationDate(areaTags)}
						<span class="text-xs text-gray-500 dark:text-gray-400">
							as of {getPopulationDate(areaTags)}
						</span>
					{/if}
				</div>
			{/if}
			{#if areaTags.area_km2}
				<div class="flex flex-col">
					<span class="text-sm tracking-wide text-gray-600 uppercase dark:text-gray-300">Area</span>
					<span class="text-2xl font-bold text-primary dark:text-white">
						{areaTags.area_km2.toLocaleString()} km²
					</span>
				</div>
			{/if}
		</div>
	{/if}

	<div
		class="border border-gray-300 dark:border-white/95 dark:bg-white/10 {total === 0
			? 'rounded-3xl'
			: 'rounded-t-3xl'} grid md:grid-cols-2 xl:grid-cols-2"
	>
		<ProfileStat
			title="Total Locations"
			stat={total}
			border="border-b xl:border-b-0 md:border-r border-gray-300 dark:border-white/95"
		/>
		<ProfileStat
			title="Recently Verified Locations"
			stat={upToDate}
			percent={total && total > 0 ? upToDatePercent : undefined}
			border="border-b xl:border-b-0 xl:border-r border-gray-300 dark:border-white/95"
			tooltip="Locations that have been verified within one year."
		/>
	</div>

	<div
		class="{total === 0
			? 'hidden'
			: ''} relative rounded-b-3xl border border-t-0 border-gray-300 p-5 dark:border-white/95 dark:bg-white/10"
	>
		{#if chartsLoading}
			<div>
				<Icon
					type="fa"
					icon="chart-pie"
					w="208"
					h="208"
					style="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse text-link/50"
				/>
			</div>
		{/if}

		<canvas bind:this={updatedChartCanvas} width="100%" height="250" />
	</div>
</section>

<section id="charts" class="space-y-10">
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<h3
			class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
		>
			{name || 'BTC Map Area'} Charts
		</h3>

		<div class="border-b border-gray-300 p-5 dark:border-white/95">
			<div class="relative">
				{#if chartsLoading}
					<div
						class="absolute top-0 left-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
					>
						<Icon type="fa" icon="chart-area" w="96" h="96" style="animate-pulse text-link/50" />
					</div>
				{/if}
				<canvas bind:this={totalChartCanvas} width="100%" height="400" />
			</div>
			<p class="mt-1 text-center text-sm text-body dark:text-white">
				*Locations accepting any bitcoin payment method.
			</p>
		</div>

		<div class="border-gray-300 p-5 dark:border-white/95">
			<div class="relative">
				{#if chartsLoading}
					<div
						class="absolute top-0 left-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
					>
						<Icon type="fa" icon="chart-area" w="96" h="96" style="animate-pulse text-link/50" />
					</div>
				{/if}
				<canvas bind:this={upToDateChartCanvas} width="100%" height="400" />
			</div>
			<p class="mt-1 text-center text-sm text-body dark:text-white">
				*Locations with a <em>survey:date</em>, <em>check_date</em>, or
				<em>check_date:currency:XBT</em> tag less than one year old.
			</p>
		</div>
	</div>
</section>

<p class="text-center text-sm text-body md:text-left dark:text-white">
	*More information on bitcoin mapping tags can be found <a
		href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#tagging-guidance"
		target="_blank"
		rel="noreferrer"
		class="text-link transition-colors hover:text-hover">here</a
	>.
	<br />
	*Chart data updated once every 24 hours.
</p>
