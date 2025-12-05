<script lang="ts">
	import { onMount } from 'svelte';
	import AreaLeaderboard from '$components/leaderboard/AreaLeaderboard.svelte';
	import Breadcrumbs from '$components/Breadcrumbs.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { areasSync } from '$lib/sync/areas';
	import { reportsSync } from '$lib/sync/reports';
	import { batchSync } from '$lib/sync/batchSync';
	import { theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';

	const routes = [
		{ name: 'Countries', url: '/countries' },
		{ name: 'Leaderboard', url: '/countries/leaderboard' }
	];

	onMount(() => {
		batchSync([areasSync, reportsSync]);
	});
</script>

<svelte:head>
	<title>BTC Map - Countries Leaderboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/top-countries.png" />
	<meta property="twitter:title" content="BTC Map - Countries Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/top-countries.png" />
</svelte:head>

<Breadcrumbs {routes} />

<main class="my-10 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl"
		>
			Top Countries
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2
		class="mx-auto w-full text-center text-xl font-semibold text-primary lg:w-[800px] dark:text-white"
	>
		Insights into bitcoin adoption worldwide!
	</h2>

	<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl" link="/countries">
		View directory
	</PrimaryButton>

	<AreaLeaderboard type="country" />
</main>
