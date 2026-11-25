<script lang="ts">
import { BADGES_PAGE, badgeTextKey } from "#lib/badges.js";
import { _ } from "#lib/i18n/index.js";
import { theme } from "#lib/theme.js";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";

import BadgeCard from "./components/BadgeCard.svelte";
</script>

<svelte:head>
	<title>BTC Map - {$_("badges.title")}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/badges.png" />
	<meta name="twitter:title" content="BTC Map - {$_("badges.title")}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/badges.png" />
</svelte:head>

<div class="my-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} mb-8 text-4xl !leading-tight font-semibold md:text-5xl"
		>
			{$_("badges.title")}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<p class="mx-auto w-full text-lg text-primary lg:w-[700px] dark:text-white">
		{$_("badges.intro")}
	</p>

	<section id="achievements" class="mt-16 mb-20 space-y-8">
		<h2 class="text-center text-3xl font-semibold text-primary dark:text-white">{$_("badges.achievements")}</h2>

		<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each BADGES_PAGE.achievements as badge (badge.key)}
				<BadgeCard
					icon={badge.icon}
					titleKey={badgeTextKey(badge, 'title')}
					descKey={badgeTextKey(badge, 'desc')}
					type={badge.type}
				/>
			{/each}
		</div>
	</section>

	<section id="contributions" class="space-y-8">
		<h2 class="text-center text-3xl font-semibold text-primary dark:text-white">{$_("badges.contributions")}</h2>

		<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each BADGES_PAGE.contributions as badge (badge.key)}
				<BadgeCard
					icon={badge.icon}
					titleKey={badgeTextKey(badge, 'title')}
					descKey={badgeTextKey(badge, 'desc')}
					type={badge.type}
				/>
			{/each}
		</div>
	</section>
</div>
