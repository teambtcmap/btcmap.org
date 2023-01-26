<script>
	import Chart from 'chart.js/auto';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { Header, Footer, PrimaryButton, CommunitySection } from '$comp';
	import { errToast } from '$lib/utils';
	import { areas, areaError, syncStatus, reports, reportError } from '$lib/store';

	// alert for area errors
	$: $areaError && errToast($areaError);

	// alert for report errors
	$: $reportError && errToast($reportError);

	let chartRendered = false;
	let initialRenderComplete = false;

	$: communities =
		$areas && $areas.length && $reports && $reports.length
			? $areas
					.filter(
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
					.sort((a, b) => {
						const nameA = a.tags.name.toUpperCase(); // ignore upper and lowercase
						const nameB = b.tags.name.toUpperCase(); // ignore upper and lowercase
						if (nameA < nameB) {
							return -1;
						}
						if (nameA > nameB) {
							return 1;
						}
						// names must be equal
						return 0;
					})
			: undefined;

	$: africa =
		communities && communities.filter((community) => community.tags.continent === 'africa');
	$: asia = communities && communities.filter((community) => community.tags.continent === 'asia');
	$: europe =
		communities && communities.filter((community) => community.tags.continent === 'europe');
	$: northAmerica =
		communities && communities.filter((community) => community.tags.continent === 'north-america');
	$: oceania =
		communities && communities.filter((community) => community.tags.continent === 'oceania');
	$: southAmerica =
		communities && communities.filter((community) => community.tags.continent === 'south-america');

	let continentChartCanvas;
	let continentChart;

	const populateChart = () => {
		continentChart = new Chart(continentChartCanvas, {
			type: 'doughnut',
			data: {
				labels: ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'],
				datasets: [
					{
						label: 'Communities by Continent',
						data: [
							africa.length,
							asia.length,
							europe.length,
							northAmerica.length,
							oceania.length,
							southAmerica.length
						],
						backgroundColor: [
							'rgba(247, 147, 26, 1)',
							'rgba(11, 144, 114, 1)',
							'rgba(247, 147, 26, 0.7)',
							'rgba(11, 144, 114, 0.7)',
							'rgba(247, 147, 26, 0.35)',
							'rgba(11, 144, 114, 0.35)'
						],
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
					},
					title: {
						display: true,
						text: `${communities.length} Total`,
						font: { size: 18 }
					}
				}
			}
		});

		chartRendered = true;
	};

	const chartSync = (status, areas) => {
		if (areas.length && !status && initialRenderComplete) {
			if (chartRendered) {
				continentChart.data.datasets[0].data = [
					africa.length,
					asia.length,
					europe.length,
					northAmerica.length,
					oceania.length,
					southAmerica.length
				];
				continentChart.update();
			} else {
				populateChart();
			}
		}
	};

	$: chartSync($syncStatus, $areas);

	onMount(async () => {
		if (browser) {
			continentChartCanvas.getContext('2d');

			if ($areas && $areas.length) {
				populateChart();
			}

			initialRenderComplete = true;
		}
	});
</script>

<svelte:head>
	<title>BTC Map - Communities</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="BTC Map - Communities" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center space-y-10 my-10 md:my-20">
			<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight">
				Join the bitcoin map community.
			</h1>

			<h2 class="text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				Take ownership of your local bitcoin mapping data and help drive adoption. Bitcoin
				communities are the spark that ignites the movement. Join your friends, onboard businesses
				and have fun!
			</h2>

			<div class="md:flex justify-center items-center space-y-5 md:space-y-0 md:space-x-5">
				<PrimaryButton
					text="Add community"
					style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
					link="/communities/add"
				/>
				<PrimaryButton
					text="View community map"
					style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
					link="/map?communitiesOnly"
				/>
			</div>

			<div class="relative">
				{#if !initialRenderComplete || !communities}
					<div class="absolute top-0 left-0 w-full h-full flex flex-col justify-between">
						<div class="flex flex-wrap justify-center">
							{#each Array(6) as skeleton}
								<div class="w-[94px] py-2 rounded-sm m-2 bg-link/50 animate-pulse" />
							{/each}
						</div>
						<div
							class="bg-link/50 rounded-full animate-pulse w-[225px] h-[225px] md:w-[300px] md:h-[300px] mx-auto"
						/>
					</div>
				{/if}
				<canvas bind:this={continentChartCanvas} width="350" height="350" />
			</div>

			<div class="space-y-20">
				<CommunitySection title="Africa" communities={africa} />
				<CommunitySection title="Asia" communities={asia} />
				<CommunitySection title="Europe" communities={europe} />
				<CommunitySection title="North America" communities={northAmerica} />
				<CommunitySection title="Oceania" communities={oceania} />
				<CommunitySection title="South America" communities={southAmerica} />
			</div>
		</main>

		<Footer />
	</div>
</div>
