<script lang="ts">
	import { goto } from '$app/navigation';
	import { CountrySection, Footer, Header, HeaderPlaceholder, PrimaryButton } from '$lib/comp';
	import { areaError, areas, theme } from '$lib/store';
	import { detectTheme, errToast, validateContinents } from '$lib/utils';
	import type { PageData } from './$types';

	export let data: PageData;

	// alert for area errors
	$: $areaError && errToast($areaError);

	$: countries =
		$areas && $areas.length
			? $areas
					.filter(
						(area) =>
							area.tags.type === 'country' &&
							area.id.length === 2 &&
							area.tags.geo_json &&
							area.tags.name &&
							area.tags.continent &&
							validateContinents(area.tags.continent)
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

	$: africa = countries && countries.filter((country) => country.tags.continent === 'Africa');
	$: asia = countries && countries.filter((country) => country.tags.continent === 'Asia');
	$: europe = countries && countries.filter((country) => country.tags.continent === 'Europe');
	$: northAmerica =
		countries && countries.filter((country) => country.tags.continent === 'North America');
	$: oceania = countries && countries.filter((country) => country.tags.continent === 'Oceania');
	$: southAmerica =
		countries && countries.filter((country) => country.tags.continent === 'South America');


	const sections = ['africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america'];
	$: countrySections = [
		{
			section: 'Africa',
			countries: africa
		},
		{
			section: 'Asia',
			countries: asia
		},
		{
			section: 'Europe',
			countries: europe
		},
		{
			section: 'North America',
			countries: northAmerica
		},
		{
			section: 'Oceania',
			countries: oceania
		},
		{
			section: 'South America',
			countries: southAmerica
		}
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

	// Handle dropdown change
	function handleSectionChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newSection = target.value;
		goto(`/countries/${newSection}`);
	}

	// Section is now validated in the load function
</script>

<svelte:head>
	<title>BTC Map - Countries</title>
	<meta property="og:image" content="https://btcmap.org/images/og/countries.png" />
	<meta property="twitter:title" content="BTC Map - Countries" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/countries.png" />
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
					Bitcoin adoption by countries.
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2 class="mx-auto w-full text-xl font-semibold text-primary dark:text-white lg:w-[800px]">
				Your country? Your map!
			</h2>

			<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl" link="/countries/leaderboard">
				View leaderboard
			</PrimaryButton>

			<div>
				<div class="mb-5 justify-between md:flex">
					{#if data.section}
						<h2
							class="mb-2 text-3xl font-semibold text-primary dark:text-white md:mb-0 md:text-left"
						>
							<a href="/countries/{data.section}">{continentDisplayNames[data.section] || data.section}</a>
						</h2>

						<select
							class="w-full rounded-2xl border-2 border-input bg-white px-2 py-3 text-primary transition-all focus:outline-link dark:bg-white/[0.15] dark:text-white md:w-auto"
							value={data.section}
							on:change={handleSectionChange}
						>
							{#each sections as option (option)}
								<option value={option}>{continentDisplayNames[option] || option}</option>
							{/each}
						</select>
					{/if}
				</div>

				{#each countrySections as item (item.section)}
					{#if continentDisplayNames[data.section] === item.section}
						<CountrySection countries={item.countries} />
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