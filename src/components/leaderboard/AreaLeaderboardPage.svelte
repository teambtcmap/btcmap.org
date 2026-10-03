<script lang="ts">
import type { Snippet } from "svelte";

import Breadcrumbs from "$components/Breadcrumbs.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import AreaLeaderboard from "$components/leaderboard/AreaLeaderboard.svelte";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";

// The /communities/leaderboard and /countries/leaderboard pages: same
// layout, per-type copy. Keys are spelled out (not built from the type) so
// they stay greppable for the locale audits.
const PAGES = {
	community: {
		section: "/communities",
		nav: "nav.communities",
		crumb: "communities.leaderboard",
		meta: "meta.communitiesLeaderboard",
		ogImage: "https://btcmap.org/images/og/top-communities.png",
		hero: "communities.leaderboardHero",
		description: "communities.leaderboardDescription",
	},
	country: {
		section: "/countries",
		nav: "nav.countries",
		crumb: "countries.leaderboard",
		meta: "meta.countriesLeaderboard",
		ogImage: "https://btcmap.org/images/og/top-countries.png",
		hero: "countries.leaderboardHero",
		description: "countries.leaderboardDescription",
	},
};

type Props = {
	type: keyof typeof PAGES;
	// The links under the description; each page has its own set.
	actions: Snippet;
};

let { type, actions }: Props = $props();

const copy = $derived(PAGES[type]);
const routes = $derived([
	{ name: $_(copy.nav), url: copy.section },
	{ name: $_(copy.crumb), url: `${copy.section}/leaderboard` },
]);
</script>

<svelte:head>
	<title>BTC Map - {$_(copy.meta)}</title>
	<meta property="og:image" content={copy.ogImage} />
	<meta property="og:title" content="BTC Map - {$_(copy.meta)}" />
	<meta name="twitter:title" content="BTC Map - {$_(copy.meta)}" />
	<meta name="twitter:image" content={copy.ogImage} />
</svelte:head>

<Breadcrumbs {routes} />

<div class="my-10 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl"
		>
			{$_(copy.hero)}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2
		class="mx-auto w-full text-center text-xl font-semibold text-primary lg:w-[800px] dark:text-white"
	>
		{$_(copy.description)}
	</h2>

	{@render actions()}

	<AreaLeaderboard {type} />
</div>
