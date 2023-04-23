<script>
	import Chart from 'chart.js/auto';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { Header, Footer, PrimaryButton, CommunitySection, HeaderPlaceholder } from '$comp';
	import { errToast, detectTheme } from '$lib/utils';
	import { areas, areaError, syncStatus, reports, reportError, theme } from '$lib/store';

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

	$: meetups2140 =
		communities &&
		communities.filter((community) => community.tags.organization === '2140-meetups');
	$: bitcoin4India =
		communities &&
		communities.filter((community) => community.tags.organization === 'bitcoin4india');
	$: bitDevs =
		communities && communities.filter((community) => community.tags.organization === 'bit-devs');
	$: breizhBitcoin =
		communities &&
		communities.filter((community) => community.tags.organization === 'breizh-bitcoin');
	$: decouvreBitcoin =
		communities &&
		communities.filter((community) => community.tags.organization === 'decouvre-bitcoin');
	$: dwadziesciaJeden =
		communities &&
		communities.filter((community) => community.tags.organization === 'dwadziescia-jeden');
	$: einundzwanzig =
		communities &&
		communities.filter((community) => community.tags.organization === 'einundzwanzig');
	$: satoshiSpritz =
		communities &&
		communities.filter((community) => community.tags.organization === 'satoshi-spritz');

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

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 space-y-10 text-center md:my-20">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-4xl font-semibold !leading-tight md:text-5xl"
				>
					Join the bitcoin map community.
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2 class="mx-auto w-full text-xl font-semibold text-primary dark:text-white lg:w-[800px]">
				Take ownership of your local bitcoin mapping data and help drive adoption. Bitcoin
				communities are the spark that ignites the movement. Join your friends, onboard businesses
				and have fun!
			</h2>

			<div class="items-center justify-center space-y-5 md:flex md:space-x-5 md:space-y-0">
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
					<div class="absolute left-0 top-0 flex h-full w-full flex-col justify-between">
						<div class="flex flex-wrap justify-center">
							{#each Array(6) as skeleton}
								<div class="m-2 w-[94px] animate-pulse rounded-sm bg-link/50 py-2" />
							{/each}
						</div>
						<div
							class="mx-auto h-[225px] w-[225px] animate-pulse rounded-full bg-link/50 md:h-[300px] md:w-[300px]"
						/>
					</div>
				{/if}
				<canvas bind:this={continentChartCanvas} width="350" height="350" />
			</div>

			<div class="space-y-20">
				<CommunitySection
					title="Africa"
					communities={africa && africa.filter((community) => !community.tags.organization)}
				/>
				<CommunitySection
					title="Asia"
					communities={asia && asia.filter((community) => !community.tags.organization)}
				/>
				<CommunitySection
					title="Europe"
					communities={europe && europe.filter((community) => !community.tags.organization)}
				/>
				<CommunitySection
					title="North America"
					communities={northAmerica &&
						northAmerica.filter((community) => !community.tags.organization)}
				/>
				<CommunitySection
					title="Oceania"
					communities={oceania && oceania.filter((community) => !community.tags.organization)}
				/>
				<CommunitySection
					title="South America"
					communities={southAmerica &&
						southAmerica.filter((community) => !community.tags.organization)}
				/>

				<CommunitySection title="2140 Meetups" communities={meetups2140} />
				<CommunitySection title="Bitcoin4India" communities={bitcoin4India} />
				<CommunitySection title="BitDevs" communities={bitDevs} />
				<CommunitySection title="Breizh Bitcoin" communities={breizhBitcoin} />
				<CommunitySection title="Découvre Bitcoin" communities={decouvreBitcoin} />
				<CommunitySection title="Dwadzieścia Jeden" communities={dwadziesciaJeden} />
				<CommunitySection title="Einundzwanzig" communities={einundzwanzig} />
				<CommunitySection title="Satoshi Spritz" communities={satoshiSpritz} />
			</div>
		</main>

		<Footer />
	</div>
</div>
