<script lang="ts">
	import { browser } from '$app/environment';
	import { CommunitySection, Footer, Header, HeaderPlaceholder, PrimaryButton } from '$lib/comp';
	import { areaError, areas, reportError, reports, syncStatus, theme } from '$lib/store';
	import { detectTheme, errToast } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { onMount } from 'svelte';

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
							area.tags.geo_json &&
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
	$: bitcoin4Iranians =
		communities &&
		communities.filter((community) => community.tags.organization === 'bitcoin-4-iranians');
	$: bitcoinBulgaria =
		communities &&
		communities.filter((community) => community.tags.organization === 'bitcoin-bulgaria');
	$: bitcoinIndonesia =
		communities &&
		communities.filter((community) => community.tags.organization === 'bitcoin-indonesia');
	$: bitcoinJamii =
		communities &&
		communities.filter((community) => community.tags.organization === 'bitcoin-jamii');
	$: bitcoinParaguay =
		communities &&
		communities.filter((community) => community.tags.organization === 'bitcoin-paraguay');
	$: bitDevs =
		communities && communities.filter((community) => community.tags.organization === 'bit-devs');
	$: breizhBitcoin =
		communities &&
		communities.filter((community) => community.tags.organization === 'breizh-bitcoin');
	$: decouvreBitcoin =
		communities &&
		communities.filter((community) => community.tags.organization === 'decouvre-bitcoin');
	$: dvadsatjeden =
		communities &&
		communities.filter((community) => community.tags.organization === 'dvadsatjeden');
	$: dwadziesciaJeden =
		communities &&
		communities.filter((community) => community.tags.organization === 'dwadziescia-jeden');
	$: eenentwintig =
		communities &&
		communities.filter((community) => community.tags.organization === 'eenentwintig');
	$: einundzwanzig =
		communities &&
		communities.filter((community) => community.tags.organization === 'einundzwanzig');
	$: enogtyve =
		communities && communities.filter((community) => community.tags.organization === 'enogtyve');
	$: goBtc =
		communities && communities.filter((community) => community.tags.organization === 'go-btc');
	$: jednadvacet =
		communities && communities.filter((community) => community.tags.organization === 'jednadvacet');
	$: miPrimerBitcoin =
		communities &&
		communities.filter((community) => community.tags.organization === 'mi-primer-bitcoin');
	$: planBNetwork =
		communities &&
		communities.filter((community) => community.tags.organization === 'plan-b-network');
	$: satoshiSomosTodos =
		communities && communities.filter((community) => community.tags.organization === 'sst');
	$: satoshiSpritz =
		communities &&
		communities.filter((community) => community.tags.organization === 'satoshi-spritz');
	$: uaibit =
		communities && communities.filter((community) => community.tags.organization === 'uaibit');

	let continentChartCanvas: HTMLCanvasElement;
	let continentChart: Chart<'doughnut', number[], string>;

	const populateChart = () => {
		if (
			africa &&
			africa.length &&
			asia &&
			asia.length &&
			europe &&
			europe.length &&
			northAmerica &&
			northAmerica.length &&
			oceania &&
			oceania.length &&
			southAmerica &&
			southAmerica.length
		) {
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
							text: `${communities?.length || 0} Total`,
							font: { size: 18 }
						}
					}
				}
			});

			chartRendered = true;
		}
	};

	const chartSync = (status: boolean) => {
		if (!status) {
			if (chartRendered) {
				continentChart.data.datasets[0].data = [
					africa?.length || 0,
					asia?.length || 0,
					europe?.length || 0,
					northAmerica?.length || 0,
					oceania?.length || 0,
					southAmerica?.length || 0
				];
				continentChart.update();
			} else {
				populateChart();
			}
		}
	};

	$: $areas &&
		$areas.length &&
		communities &&
		communities.length &&
		initialRenderComplete &&
		chartSync($syncStatus);

	let section: string;
	const sections = [
		'--Continents--',
		'Africa',
		'Asia',
		'Europe',
		'North America',
		'Oceania',
		'South America',
		'--Organizations--',
		'2140 Meetups',
		'Bitcoin4India',
		'Bitcoin 4 Iranians',
		'Bitcoin Bulgaria',
		'Bitcoin Indonesia',
		'Bitcoin Jamii',
		'Bitcoin Paraguay',
		'BitDevs',
		'Breizh Bitcoin',
		'Découvre Bitcoin',
		'Dvadsaťjeden',
		'Dwadzieścia Jeden',
		'Eenentwintig',
		'Einundzwanzig',
		'Enogtyve',
		'Go BTC',
		'Jednadvacet',
		'Mi Primer Bitcoin',
		'Plan B Network',
		'Satoshi Somos Todos',
		'Satoshi Spritz',
		'UAIBIT'
	];
	$: communitySections = [
		{
			section: 'Africa',
			communities: africa && africa.filter((community) => !community.tags.organization)
		},
		{
			section: 'Asia',
			communities: asia && asia.filter((community) => !community.tags.organization)
		},
		{
			section: 'Europe',
			communities: europe && europe.filter((community) => !community.tags.organization)
		},
		{
			section: 'North America',
			communities: northAmerica && northAmerica.filter((community) => !community.tags.organization)
		},
		{
			section: 'Oceania',
			communities: oceania && oceania.filter((community) => !community.tags.organization)
		},
		{
			section: 'South America',
			communities: southAmerica && southAmerica.filter((community) => !community.tags.organization)
		},
		{ section: '2140 Meetups', communities: meetups2140 },
		{ section: 'Bitcoin4India', communities: bitcoin4India },
		{ section: 'Bitcoin 4 Iranians', communities: bitcoin4Iranians },
		{ section: 'Bitcoin Bulgaria', communities: bitcoinBulgaria },
		{ section: 'Bitcoin Indonesia', communities: bitcoinIndonesia },
		{ section: 'Bitcoin Jamii', communities: bitcoinJamii },
		{ section: 'Bitcoin Paraguay', communities: bitcoinParaguay },
		{ section: 'BitDevs', communities: bitDevs },
		{ section: 'Breizh Bitcoin', communities: breizhBitcoin },
		{ section: 'Découvre Bitcoin', communities: decouvreBitcoin },
		{ section: 'Dvadsaťjeden', communities: dvadsatjeden },
		{ section: 'Dwadzieścia Jeden', communities: dwadziesciaJeden },
		{ section: 'Eenentwintig', communities: eenentwintig },
		{ section: 'Einundzwanzig', communities: einundzwanzig },
		{ section: 'Enogtyve', communities: enogtyve },
		{ section: 'Go BTC', communities: goBtc },
		{ section: 'Jednadvacet', communities: jednadvacet },
		{ section: 'Mi Primer Bitcoin', communities: miPrimerBitcoin },
		{ section: 'Plan B Network', communities: planBNetwork },
		{ section: 'Satoshi Somos Todos', communities: satoshiSomosTodos },
		{ section: 'Satoshi Spritz', communities: satoshiSpritz },
		{ section: 'UAIBIT', communities: uaibit }
	];

	onMount(async () => {
		if (browser) {
			continentChartCanvas.getContext('2d');

			if (location.hash) {
				section = decodeURIComponent(location.hash).slice(1);
			} else {
				section = 'Africa';
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

			<div>
				<PrimaryButton
					style="md:w-[200px] mx-auto py-3 rounded-xl mb-5"
					link="/communities/leaderboard"
				>
					Leaderboard
				</PrimaryButton>

				<div class="items-center justify-center space-y-5 md:flex md:space-x-5 md:space-y-0">
					<PrimaryButton
						style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
						link="/communities/add"
					>
						Add community
					</PrimaryButton>
					<PrimaryButton
						style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
						link="/communities/map"
					>
						View community map
					</PrimaryButton>
				</div>
			</div>

			<div class="relative">
				{#if !initialRenderComplete || !communities}
					<div class="absolute left-0 top-0 flex h-full w-full flex-col justify-between">
						<div class="flex flex-wrap justify-center">
							{#each Array(6) as _, i (i)}
								<div class="m-2 w-[94px] animate-pulse rounded-sm bg-link/50 py-2" />
							{/each}
						</div>
						<div
							class="mx-auto h-[225px] w-[225px] animate-pulse rounded-full bg-link/50 md:h-[300px] md:w-[300px]"
						/>
					</div>
				{/if}
				<canvas bind:this={continentChartCanvas} width="100%" height="350" />
			</div>

			<div>
				<div class="mb-5 justify-between md:flex">
					{#if section}
						<h2
							class="mb-2 text-3xl font-semibold text-primary dark:text-white md:mb-0 md:text-left"
						>
							<a href="/communities#{encodeURIComponent(section)}">{section}</a>
						</h2>

						<select
							class="w-full rounded-2xl border-2 border-input bg-white px-2 py-3 text-primary transition-all focus:outline-link dark:bg-white/[0.15] dark:text-white md:w-auto"
							bind:value={section}
							on:change={(e) => {
								// @ts-expect-error
								section = e.target?.value;
								// @ts-expect-error
								location.hash = encodeURIComponent(e.target?.value);
							}}
						>
							{#each sections as option (option)}
								<option disabled={option.startsWith('--')} value={option}>{option}</option>
							{/each}
						</select>
					{/if}
				</div>

				{#each communitySections as item (item.section)}
					{#if section === item.section}
						<CommunitySection communities={item.communities} />
					{/if}
				{/each}
			</div>
		</main>

		<Footer />
	</div>
</div>

{#if typeof window !== 'undefined'}
	{#if detectTheme() === 'dark' || $theme === 'dark'}
		<style>
			select option {
				--tw-bg-opacity: 1;
				background-color: rgb(55 65 81 / var(--tw-bg-opacity));
			}
		</style>
	{/if}
{/if}
