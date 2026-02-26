<script lang="ts">
import { onMount } from "svelte";

import Breadcrumbs from "$components/Breadcrumbs.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import AreaLeaderboard from "$components/leaderboard/AreaLeaderboard.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
import { areasSync } from "$lib/sync/areas";
import { batchSync } from "$lib/sync/batchSync";
import { reportsSync } from "$lib/sync/reports";
import { theme } from "$lib/theme";

$: routes = [
	{ name: $_("nav.communities"), url: "/communities" },
	{ name: $_("communities.leaderboard"), url: "/communities/leaderboard" },
];

onMount(() => {
	batchSync([areasSync, reportsSync]);
});
</script>

<svelte:head>
	<title>BTC Map - {$_('meta.communitiesLeaderboard')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/top-communities.png" />
	<meta property="og:title" content="BTC Map - {$_('meta.communitiesLeaderboard')}" />
	<meta name="twitter:title" content="BTC Map - {$_('meta.communitiesLeaderboard')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/top-communities.png" />
</svelte:head>

<Breadcrumbs {routes} />

<div class="my-10 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl"
		>
			{$_('communities.leaderboardHero')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2
		class="mx-auto w-full text-center text-xl font-semibold text-primary lg:w-[800px] dark:text-white"
	>
		{$_('communities.leaderboardDescription')}
	</h2>

	<div>
		<PrimaryButton style="w-full md:w-[200px] mx-auto py-3 rounded-xl mb-5" link="/communities">
			{$_('communities.directory')}
		</PrimaryButton>

		<div class="flex flex-col items-center justify-center gap-5 md:flex-row">
			<PrimaryButton style="w-full md:w-[200px] py-3 rounded-xl" link="/communities/add">
				{$_('communities.addCommunity')}
			</PrimaryButton>
			<PrimaryButton style="w-full md:w-[200px] py-3 rounded-xl" link="/communities/map">
				{$_('communities.viewMap')}
			</PrimaryButton>
		</div>
	</div>

	<AreaLeaderboard type="community" />
</div>
