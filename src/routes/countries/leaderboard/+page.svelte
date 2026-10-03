<script lang="ts">
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import AreaLeaderboard from "$components/leaderboard/AreaLeaderboard.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";

$: routes = [
	{ name: $_("nav.countries"), url: "/countries" },
	{ name: $_("countries.leaderboard"), url: "/countries/leaderboard" },
];
</script>

<svelte:head>
	<title>BTC Map - {$_('meta.countriesLeaderboard')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/top-countries.png" />
	<meta property="og:title" content="BTC Map - {$_('meta.countriesLeaderboard')}" />
	<meta name="twitter:title" content="BTC Map - {$_('meta.countriesLeaderboard')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/top-countries.png" />
</svelte:head>

<Breadcrumbs {routes} />

<div class="my-10 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl"
		>
			{$_('countries.leaderboardHero')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2
		class="mx-auto w-full text-center text-xl font-semibold text-primary lg:w-[800px] dark:text-white"
	>
		{$_('countries.leaderboardDescription')}
	</h2>

	<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl" link="/countries">
		{$_('countries.viewDirectory')}
	</PrimaryButton>

	<AreaLeaderboard type="country" />
</div>
