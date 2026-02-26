<script lang="ts">
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";
import { BadgeType } from "$lib/types";

import BadgeCard from "./components/BadgeCard.svelte";

const achievements = [
	{ key: "geyserTournament", icon: "geyser" },
	{ key: "topTagger", icon: "top-tagger" },
	{ key: "podium", icon: "podium" },
	{ key: "highRank", icon: "high-rank" },
	{ key: "ogSupertagger", icon: "og-supertagger" },
	{ key: "lightningJunkie", icon: "lightning-junkie" },
	{ key: "helloWorld", icon: "hello-world" },
	{ key: "demolitionSpecialist", icon: "demolition-specialist" },
	{ key: "updateMaxi", icon: "update-maxi" },
	{ key: "creator", icon: "creator" },
	{ key: "supporter", icon: "supporter" },
];

const contributions = [
	{ key: "hyperbitcoinisation", icon: "hyperbitcoinisation" },
	{ key: "pizzaTime", icon: "pizza-time" },
	{ key: "godly", icon: "godly" },
	{ key: "shadow", icon: "shadow" },
	{ key: "whitepaper", icon: "whitepaper" },
	{ key: "winston", icon: "winston" },
	{ key: "whale", icon: "whale" },
	{ key: "infinity", icon: "infinity" },
	{ key: "legend", icon: "legend" },
	{ key: "chancellor", icon: "chancellor" },
	{ key: "sha", icon: "sha" },
	{ key: "noBailouts", icon: "no-bailouts" },
	{ key: "supertagger", icon: "supertagger" },
	{ key: "ath", icon: "ath" },
	{ key: "longestChain", icon: "longest-chain" },
	{ key: "satoshi", icon: "satoshi" },
	{ key: "heartbeat", icon: "heartbeat" },
	{ key: "segwit", icon: "segwit" },
	{ key: "wholeTagger", icon: "whole-tagger" },
];
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
			{#each [...achievements].reverse() as achievement (achievement.key)}
				<BadgeCard
					icon={achievement.icon}
					titleKey={`badges.achievement.${achievement.key}.title`}
					descKey={`badges.achievement.${achievement.key}.desc`}
					type={BadgeType.Achievement}
				/>
			{/each}
		</div>
	</section>

	<section id="contributions" class="space-y-8">
		<h2 class="text-center text-3xl font-semibold text-primary dark:text-white">{$_("badges.contributions")}</h2>

		<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each [...contributions].reverse() as contribution (contribution.key)}
				<BadgeCard
					icon={contribution.icon}
					titleKey={`badges.contribution.${contribution.key}.title`}
					descKey={`badges.contribution.${contribution.key}.desc`}
					type={BadgeType.Contribution}
				/>
			{/each}
		</div>
	</section>
</div>
