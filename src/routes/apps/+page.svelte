<script lang="ts">
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import { appConfigs } from "$lib/apps";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";

import AppCard from "./components/AppCard.svelte";

const btcmapApps = appConfigs.filter((a) => a.tag === "btcmap");
const poweredByApps = appConfigs
	.filter((a) => a.tag === "powered-by-btcmap")
	.sort((a, b) => Number(b.sponsor) - Number(a.sponsor));
const comingSoonApps = appConfigs.filter((a) => a.tag === "coming-soon");
</script>

<svelte:head>
	<title>BTC Map - {$_('nav.apps')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/apps.png" />
	<meta property="og:title" content="BTC Map - {$_('nav.apps')}" />
	<meta name="twitter:title" content="BTC Map - {$_('nav.apps')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/apps.png" />
</svelte:head>

<div class="my-10 space-y-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-4xl !leading-tight font-semibold text-primary md:text-5xl dark:text-white"
		>
			{$_('apps.hero')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2 class="mx-auto w-full text-xl font-semibold text-primary lg:w-[800px] dark:text-white">
		{$_('apps.subheading')}
	</h2>

	<h3 class="text-2xl font-semibold text-primary md:text-left dark:text-white">{$_('apps.btcmap')}</h3>
	<section id="btcmap-apps" class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each btcmapApps as app (app.id)}
			<AppCard {app} />
		{/each}
	</section>

	{#if poweredByApps.length > 0}
		<h3 class="text-2xl font-semibold text-primary md:text-left dark:text-white">{$_('apps.poweredBy')}</h3>
		<section id="powered-by-apps" class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each poweredByApps as app (app.id)}
				<AppCard {app} />
			{/each}
		</section>
	{/if}

	{#if comingSoonApps.length > 0}
		<h3 class="text-2xl font-semibold text-primary md:text-left dark:text-white">{$_('apps.comingSoon')}</h3>
		<section id="coming-soon-apps" class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each comingSoonApps as app (app.id)}
				<AppCard {app} />
			{/each}
		</section>
	{/if}
</div>
