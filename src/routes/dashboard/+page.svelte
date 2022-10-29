<script>
	import axios from 'axios';
	import Chart from 'chart.js/dist/chart.min.js';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { Header, Footer, DashboardStat } from '$comp';
	import { events, eventError, syncStatus } from '$lib/store';
	import { errToast } from '$lib/utils';

	// alert for event errors
	$: $eventError && errToast($eventError);

	let statsAPIInterval;
	let communitiesAPIInterval;

	let statsLoading = true;
	let communitiesLoading = true;
	let initialRenderComplete = false;

	let stats;
	let communities;

	const getStatPeriod = () => {
		return new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
	};

	const getStat = (stat) => {
		return $events.filter((event) => {
			let statPeriod = getStatPeriod();
			if (event.type === stat && Date.parse(event['created_at']) > statPeriod) {
				return true;
			} else {
				return false;
			}
		}).length;
	};

	const getStatPrevious = (stat) => {
		return $events.filter((event) => {
			let statPeriod = getStatPeriod();
			let previousStatPeriod = new Date(new Date().getTime() - 48 * 60 * 60 * 1000);
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
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(total - stats[1].tags.total_elements)
			.toString();

	$: createdPercentChange =
		created &&
		createdPrevious &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format((((created - createdPrevious) / createdPrevious) * 100).toFixed(1))
			.toString();

	$: updatedPercentChange =
		updated &&
		updatedPrevious &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format((((updated - updatedPrevious) / updatedPrevious) * 100).toFixed(1))
			.toString();

	$: deletedPercentChange =
		deleted &&
		deletedPrevious &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format((((deleted - deletedPrevious) / deletedPrevious) * 100).toFixed(1))
			.toString();

	$: onchainPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(
					((onchain - stats[1].tags.total_elements_onchain) /
						stats[1].tags.total_elements_onchain) *
					100
				).toFixed(1)
			)
			.toString();

	$: lightningPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(
					((lightning - stats[1].tags.total_elements_lightning) /
						stats[1].tags.total_elements_lightning) *
					100
				).toFixed(1)
			)
			.toString();

	$: nfcPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(
					((nfc - stats[1].tags.total_elements_lightning_contactless) /
						stats[1].tags.total_elements_lightning_contactless) *
					100
				).toFixed(1)
			)
			.toString();

	let totalChartCanvas;
	let totalChart;
	let upToDateChartCanvas;
	let upToDateChart;
	let legacyChartCanvas;
	let legacyChart;
	let paymentMethodChartCanvas;
	let paymentMethodChart;

	onMount(async () => {
		if (browser) {
			totalChartCanvas.getContext('2d');
			upToDateChartCanvas.getContext('2d');
			legacyChartCanvas.getContext('2d');
			paymentMethodChartCanvas.getContext('2d');

			const statsAPI = async () => {
				statsLoading = true;

				await axios
					.get('https://api.btcmap.org/v2/reports')
					.then(function (response) {
						// handle success
						stats = response.data
							.filter((report) => report['area_id'] === '')
							.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

						let statsCopy = [...stats];
						let statsSorted = statsCopy.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

						if (initialRenderComplete) {
							totalChart.data.labels = statsSorted.map(({ date }) => date);
							totalChart.data.datasets[0].data = statsSorted.map(
								({ tags: { total_elements } }) => total_elements
							);
							totalChart.update();

							upToDateChart.data.labels = statsSorted.map(({ date }) => date);
							upToDateChart.data.datasets[0].data = statsSorted.map(
								({ tags: { up_to_date_elements } }) => up_to_date_elements
							);
							upToDateChart.update();

							legacyChart.data.labels = statsSorted.map(({ date }) => date);
							legacyChart.data.datasets[0].data = statsSorted.map(
								({ tags: { legacy_elements } }) => legacy_elements
							);
							legacyChart.update();

							paymentMethodChart.data.labels = statsSorted.map(({ date }) => date);
							paymentMethodChart.data.datasets[0].data = statsSorted.map(
								({ tags: { total_elements_onchain } }) => total_elements_onchain
							);
							paymentMethodChart.data.datasets[1].data = statsSorted.map(
								({ tags: { total_elements_lightning } }) => total_elements_lightning
							);
							paymentMethodChart.data.datasets[2].data = statsSorted.map(
								({ tags: { total_elements_lightning_contactless } }) =>
									total_elements_lightning_contactless
							);
							paymentMethodChart.update();
						} else {
							totalChart = new Chart(totalChartCanvas, {
								type: 'line',
								data: {
									labels: statsSorted.map(({ date }) => date),
									datasets: [
										{
											label: 'Total Locations',
											data: statsSorted.map(({ tags: { total_elements } }) => total_elements),
											fill: false,
											borderColor: 'rgb(0, 153, 175)',
											tension: 0.1
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
											}
										},
										y: {
											ticks: {
												font: {
													weight: 600
												}
											}
										}
									}
								}
							});

							upToDateChart = new Chart(upToDateChartCanvas, {
								type: 'line',
								data: {
									labels: statsSorted.map(({ date }) => date),
									datasets: [
										{
											label: 'Up-to-date Locations',
											data: statsSorted.map(
												({ tags: { up_to_date_elements } }) => up_to_date_elements
											),
											fill: false,
											borderColor: 'rgb(11, 144, 114)',
											tension: 0.1
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
											}
										},
										y: {
											ticks: {
												font: {
													weight: 600
												}
											}
										}
									}
								}
							});

							legacyChart = new Chart(legacyChartCanvas, {
								type: 'line',
								data: {
									labels: statsSorted.map(({ date }) => date),
									datasets: [
										{
											label: 'Legacy Locations',
											data: statsSorted.map(({ tags: { legacy_elements } }) => legacy_elements),
											fill: false,
											borderColor: 'rgb(235, 87, 87)',
											tension: 0.1
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
											}
										},
										y: {
											ticks: {
												font: {
													weight: 600
												}
											}
										}
									}
								}
							});

							paymentMethodChart = new Chart(paymentMethodChartCanvas, {
								type: 'line',
								data: {
									labels: statsSorted.map(({ date }) => date),
									datasets: [
										{
											label: 'On-chain',
											data: statsSorted.map(
												({ tags: { total_elements_onchain } }) => total_elements_onchain
											),
											fill: false,
											borderColor: 'rgb(247, 147, 26)',
											tension: 0.1
										},
										{
											label: 'Lightning',
											data: statsSorted.map(
												({ tags: { total_elements_lightning } }) => total_elements_lightning
											),
											fill: false,
											borderColor: 'rgb(249, 193, 50)',
											tension: 0.1
										},
										{
											label: 'Contactless',
											data: statsSorted.map(
												({ tags: { total_elements_lightning_contactless } }) =>
													total_elements_lightning_contactless
											),
											fill: false,
											borderColor: 'rgb(102, 16, 242)',
											tension: 0.1
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
											}
										},
										y: {
											ticks: {
												font: {
													weight: 600
												}
											}
										}
									}
								}
							});
						}
					})
					.catch(function (error) {
						// handle error
						errToast('Could not fetch stats data, please try again or contact BTC Map.');
						console.log(error);
					});

				statsLoading = false;
			};
			await statsAPI();
			statsAPIInterval = setInterval(statsAPI, 600000);

			const communitiesAPI = async () => {
				communitiesLoading = true;

				await axios
					.get('https://api.btcmap.org/v2/areas')
					.then(function (response) {
						// handle success
						communities = response.data.filter((area) => area.tags.type === 'community');
						communities = communities;
					})
					.catch(function (error) {
						// handle error
						errToast('Could not fetch communities data, please try again or contact BTC Map.');
						console.log(error);
					});

				communitiesLoading = false;
			};
			communitiesAPI();
			communitiesAPIInterval = setInterval(communitiesAPI, 600000);

			initialRenderComplete = true;
		}
	});

	onDestroy(() => {
		clearInterval(statsAPIInterval);
		clearInterval(communitiesAPIInterval);
	});
</script>

<svelte:head>
	<title>BTC Map - Dashboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/dash.png" />
	<meta property="twitter:title" content="BTC Map - Dashboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/dash.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="space-y-10 mt-10 mb-20">
			<h1
				class="text-center md:text-left text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight"
			>
				Dashboard
			</h1>

			<h2 class="text-center md:text-left text-primary text-xl font-semibold w-full lg:w-[675px]">
				Here are some stats and charts for the MATH nerds.
			</h2>

			<section id="stats">
				<div class="border border-statBorder rounded-3xl grid md:grid-cols-2 xl:grid-cols-4">
					<DashboardStat
						title="Total Locations"
						stat={total}
						change={totalChange}
						border="border-b md:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Created in last 24 hours"
						stat={created}
						percent={createdPercentChange}
						border="border-b xl:border-r border-statBorder"
						loading={$syncStatus}
					/>
					<DashboardStat
						title="Updated in last 24 hours"
						stat={updated}
						percent={updatedPercentChange}
						border="border-b md:border-r border-statBorder"
						loading={$syncStatus}
					/>
					<DashboardStat
						title="Deleted in last 24 hours"
						stat={deleted}
						percent={deletedPercentChange}
						border="border-b border-statBorder"
						loading={$syncStatus}
					/>
					<DashboardStat
						title="Merchants accepting on-chain"
						stat={onchain}
						percent={onchainPercentChange}
						border="border-b xl:border-b-0 md:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Merchants accepting lightning"
						stat={lightning}
						percent={lightningPercentChange}
						border="border-b xl:border-b-0 xl:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Merchants accepting contactless"
						stat={nfc}
						percent={nfcPercentChange}
						border="border-b md:border-b-0 md:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Number of communities"
						stat={communities && communities.length}
						percent=""
						border=""
						loading={communitiesLoading}
					/>
				</div>
				<p class="text-sm text-body">
					*Data updated every 10 minutes, change based on previous 24 hours.
				</p>
			</section>

			<section id="charts" class="space-y-10">
				<div>
					<div class="relative">
						{#if statsLoading}
							<div
								class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
							/>
						{/if}
						<canvas bind:this={totalChartCanvas} width="400" height="400" />
					</div>
					<p class="text-sm text-body text-center mt-1">
						*Elements accepting any bitcoin payment method.
					</p>
				</div>

				<div>
					<div class="relative">
						{#if statsLoading}
							<div
								class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
							/>
						{/if}
						<canvas bind:this={upToDateChartCanvas} width="400" height="400" />
					</div>
					<p class="text-sm text-body text-center mt-1">
						*Elements with a <em>survey:date</em> or <em>check_date</em> tag less than one year old.
					</p>
				</div>

				<div>
					<div class="relative">
						{#if statsLoading}
							<div
								class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
							/>
						{/if}
						<canvas bind:this={legacyChartCanvas} width="400" height="400" />
					</div>
					<p class="text-sm text-body text-center mt-1">
						*Elements with a <em>payment:bitcoin</em> tag instead of the
						<em>currency:XBT</em> tag.
					</p>
				</div>

				<div>
					<div class="relative">
						{#if statsLoading}
							<div
								class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
							/>
						{/if}
						<canvas bind:this={paymentMethodChartCanvas} width="400" height="400" />
					</div>
					<p class="text-sm text-body text-center mt-1">
						*Elements with <em>payment:onchain</em>, <em>payment:lightning</em> and
						<em>payment:lightning_contactless</em> tags.
					</p>
				</div>
			</section>

			<p class="text-sm text-body">
				*More information on bitcoin mapping tags can be found <a
					href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#tagging-guidance"
					target="_blank"
					rel="noreferrer"
					class="text-link hover:text-hover">here</a
				>.
			</p>
		</main>

		<Footer />
	</div>
</div>
