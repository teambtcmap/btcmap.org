<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	import CommunitySection from './components/CommunitySection.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { areaError, areas, reportError, syncStatus, theme } from '$lib/store';
	import { areasSync } from '$lib/sync/areas';
	import { detectTheme, errToast } from '$lib/utils';
	import { getOrganizationDisplayName } from '$lib/organizationDisplayNames';
	import type { Community } from '$lib/types';
	import Chart from 'chart.js/auto';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';

	export let data: PageData;

	// alert for area errors
	$: $areaError && errToast($areaError);

	// alert for report errors
	$: $reportError && errToast($reportError);

	let chartRendered = false;
	let initialRenderComplete = false;

	$: communities =
		$areas && $areas.length
			? ($areas
					.filter(
						(area): area is Community =>
							area.tags.type === 'community' &&
							!!area.tags.geo_json &&
							!!area.tags.name &&
							!!area.tags['icon:square'] &&
							!!area.tags.continent
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
					}) as Community[])
			: undefined;

	const hasOrganization = (community: Community, orgName: string) => {
		if (!community.tags.organization) return false;
		const orgs = community.tags.organization.split(',').map((o: string) => o.trim());
		return orgs.includes(orgName);
	};

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

	// Get unique organizations from community data
	$: uniqueOrganizations = communities
		? Array.from(
				new Set(
					communities
						.filter((community) => community.tags.organization)
						.flatMap((community) =>
							community.tags.organization!.split(',').map((org) => org.trim())
						)
				)
			).sort()
		: [];

	// Generate organization sections dynamically
	$: organizationSections = uniqueOrganizations.map((orgId) => ({
		id: orgId,
		displayName: getOrganizationDisplayName(orgId),
		communities: communities?.filter((community) => hasOrganization(community, orgId)) || []
	}));

	// Validate organization sections and redirect if invalid
	$: if (data.isOrganization && organizationSections.length > 0) {
		const isValidOrganization = organizationSections.some((org) => org.id === data.section);
		if (!isValidOrganization) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto('/communities/africa', { replaceState: true });
		}
	}

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

	// Generate sections dynamically
	$: sections = [
		'--Continents--',
		'africa',
		'asia',
		'europe',
		'north-america',
		'oceania',
		'south-america',
		'--Organizations--',
		...organizationSections.map((org) => org.id)
	];

	$: communitySections = [
		{
			section: 'africa',
			communities: africa
		},
		{
			section: 'asia',
			communities: asia
		},
		{
			section: 'europe',
			communities: europe
		},
		{
			section: 'north-america',
			communities: northAmerica
		},
		{
			section: 'oceania',
			communities: oceania
		},
		{
			section: 'south-america',
			communities: southAmerica
		},
		...organizationSections.map((org) => ({
			section: org.id,
			communities: org.communities
		}))
	];

	// Map continent tag values to display names
	const continentDisplayNames: Record<string, string> = {
		africa: 'Africa',
		asia: 'Asia',
		europe: 'Europe',
		'north-america': 'North America',
		oceania: 'Oceania',
		'south-america': 'South America'
	};

	// Handle section changes via dropdown
	const handleSectionChange = (newSection: string) => {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`/communities/${newSection}`, { replaceState: false });
	};

	onMount(() => {
		areasSync();

		if (browser) {
			continentChartCanvas.getContext('2d');
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

<main class="my-10 space-y-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-4xl !leading-tight font-semibold md:text-5xl"
		>
			Join the bitcoin map community.
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2 class="mx-auto w-full text-xl font-semibold text-primary lg:w-[800px] dark:text-white">
		Take ownership of your local bitcoin mapping data and help drive adoption. Bitcoin communities
		are the spark that ignites the movement. Join your friends, onboard businesses and have fun!
	</h2>

	<div>
		<PrimaryButton
			style="md:w-[200px] mx-auto py-3 rounded-xl mb-5"
			link="/communities/leaderboard"
		>
			Leaderboard
		</PrimaryButton>

		<div class="flex flex-col items-center justify-center gap-5 md:flex-row">
			<PrimaryButton style="md:w-[200px] py-3 rounded-xl w-full" link="/communities/add">
				Add community
			</PrimaryButton>
			<PrimaryButton style="md:w-[200px] py-3 rounded-xl w-full" link="/communities/map">
				View community map
			</PrimaryButton>
		</div>
	</div>

	<div class="relative">
		{#if !initialRenderComplete || !communities}
			<div class="absolute top-0 left-0 flex h-full w-full flex-col justify-between">
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
			{#if data.section}
				<h2 class="mb-2 text-3xl font-semibold text-primary md:mb-0 md:text-left dark:text-white">
					<a href={resolve(`/communities/${data.section}`)}>
						{organizationSections.find((org) => org.id === data.section)?.displayName ||
							continentDisplayNames[data.section] ||
							data.section}
					</a>
				</h2>

				<select
					class="w-full rounded-2xl border-2 border-input bg-white px-2 py-3 text-primary transition-all focus:outline-link md:w-auto dark:bg-white/[0.15] dark:text-white"
					bind:value={data.section}
					on:change={(e) => {
						// @ts-expect-error
						const newSection = e.target?.value;
						if (newSection) {
							handleSectionChange(newSection);
						}
					}}
				>
					{#each sections as option (option)}
						<option disabled={option.startsWith('--')} value={option}>
							{option.startsWith('--')
								? option
								: organizationSections.find((org) => org.id === option)?.displayName ||
									continentDisplayNames[option] ||
									option}
						</option>
					{/each}
				</select>
			{/if}
		</div>

		{#each communitySections as item (item.section)}
			{#if data.section === item.section}
				<CommunitySection communities={item.communities} />
			{/if}
		{/each}
	</div>
</main>

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
