<script lang="ts">
import { onMount } from "svelte";

import FormSelect from "$components/form/FormSelect.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { areaError, areas } from "$lib/store";
import { areasSync } from "$lib/sync/areas";
import { theme } from "$lib/theme";
import { errToast, validateContinents } from "$lib/utils";

import type { PageData } from "./$types";
import CountrySection from "./components/CountrySection.svelte";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";

export let data: PageData;

onMount(() => {
	areasSync();
});

// alert for area errors
$: $areaError && errToast($areaError);

$: countries = $areas?.length
	? $areas
			.filter(
				(area) =>
					area.tags.type === "country" &&
					area.id.length === 2 &&
					area.tags.geo_json &&
					area.tags.name &&
					area.tags.continent &&
					validateContinents(area.tags.continent),
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

$: africa = countries?.filter((country) => country.tags.continent === "Africa");
$: asia = countries?.filter((country) => country.tags.continent === "Asia");
$: europe = countries?.filter((country) => country.tags.continent === "Europe");
$: northAmerica = countries?.filter(
	(country) => country.tags.continent === "North America",
);
$: oceania = countries?.filter(
	(country) => country.tags.continent === "Oceania",
);
$: southAmerica = countries?.filter(
	(country) => country.tags.continent === "South America",
);

const sections = [
	"africa",
	"asia",
	"europe",
	"north-america",
	"oceania",
	"south-america",
];
$: countrySections = [
	{
		section: "Africa",
		countries: africa,
	},
	{
		section: "Asia",
		countries: asia,
	},
	{
		section: "Europe",
		countries: europe,
	},
	{
		section: "North America",
		countries: northAmerica,
	},
	{
		section: "Oceania",
		countries: oceania,
	},
	{
		section: "South America",
		countries: southAmerica,
	},
];

// Map continent tag values to display names
const continentDisplayNames: Record<string, string> = {
	africa: "Africa",
	asia: "Asia",
	europe: "Europe",
	"north-america": "North America",
	oceania: "Oceania",
	"south-america": "South America",
};

// Handle dropdown change
function handleSectionChange(event: Event) {
	const target = event.target as HTMLSelectElement;
	const newSection = target.value;
	// eslint-disable-next-line svelte/no-navigation-without-resolve
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

<main class="my-10 space-y-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-4xl !leading-tight font-semibold md:text-5xl"
		>
			Bitcoin adoption by countries.
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2 class="mx-auto w-full text-xl font-semibold text-primary lg:w-[800px] dark:text-white">
		Your country? Your map!
	</h2>

	<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl" link="/countries/leaderboard">
		View leaderboard
	</PrimaryButton>

	<div>
		<div class="mb-5 justify-between md:flex">
			{#if data.section}
				<h2 class="mb-2 text-3xl font-semibold text-primary md:mb-0 md:text-left dark:text-white">
					<a href={resolve(`/countries/${data.section}`)}
						>{continentDisplayNames[data.section] || data.section}</a
					>
				</h2>

				<FormSelect value={data.section} on:change={handleSectionChange} style="md:w-auto">
					{#each sections as option (option)}
						<option value={option}>{continentDisplayNames[option] || option}</option>
					{/each}
				</FormSelect>
			{/if}
		</div>

		{#each countrySections as item (item.section)}
			{#if continentDisplayNames[data.section] === item.section}
				<CountrySection countries={item.countries} />
			{/if}
		{/each}
	</div>
</main>
