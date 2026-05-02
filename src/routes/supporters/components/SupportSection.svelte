<script lang="ts">
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";

import type { Sponsor, SponsorshipTier } from "../sponsors";

export let tier: SponsorshipTier;
export let sponsors: Sponsor[];
export let compact = false;

const levelStyles: Partial<Record<SponsorshipTier["level"], string>> = {
	// Tiers use the brand teal/cyan palette at pastel intensities, differentiated by shade step.
	// highlight (#051173 navy) and bitcoin orange are used as accent tones for upper tiers.
	Explorer:
		"border-cyan-300/60 bg-cyan-50/60 dark:border-cyan-400/30 dark:bg-cyan-500/10",
	Wayfinder:
		"border-[#BDD2D4]/80 bg-[#E4EBEC]/60 dark:border-[#BDD2D4]/25 dark:bg-[#E4EBEC]/5",
	Cartographer:
		"border-[#0099AF]/40 bg-[#F0F6F6]/80 dark:border-[#0099AF]/30 dark:bg-[#0099AF]/10",
	Navigator:
		"border-[#095D73]/40 bg-[#D4E1E2]/50 dark:border-[#095D73]/40 dark:bg-[#095D73]/10",
	Pioneer:
		"border-[#051173]/30 bg-[#E4EBEC]/70 dark:border-[#051173]/40 dark:bg-[#051173]/10",
};

$: cardStyle = levelStyles[tier.level] ?? "";
$: t = $_;
</script>

<article class="rounded-2xl border p-6 text-left shadow-sm {cardStyle}">
	<div class="mb-6 space-y-1">
		<h3 class="text-2xl font-bold text-primary dark:text-white">{tier.level}s</h3>
		<p class="text-base text-body/70 dark:text-slate-400">{t(tier.headlineKey)}</p>
	</div>

	<div class="grid w-full gap-4 {compact ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'} {compact ? '' : 'gap-8'}">
		{#each sponsors as sponsor (sponsor.url)}
			<a
				href={sponsor.url}
				target="_blank"
				rel="noopener noreferrer"
				class="block w-full self-center rounded-xl border border-white/40 bg-white/60 p-3 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900/40"
			>
				{#if sponsor.icon && typeof window !== 'undefined'}
					<img
						src="{sponsor.iconDark
							? $theme === 'dark'
								? sponsor.iconDark
								: sponsor.icon
							: sponsor.icon}"
						alt={sponsor.name}
						class="mx-auto w-auto object-contain {compact ? 'h-[56px]' : 'h-[90px]'}"
					/>
				{:else}
					<div
						class="mx-auto flex w-full items-center justify-center rounded-lg border border-dashed border-link/35 px-3 text-center font-semibold text-primary dark:text-white {compact ? 'h-[56px] text-lg' : 'h-[90px] text-2xl'}"
					>
						{sponsor.name}
					</div>
				{/if}
				<p class="text-center font-medium text-primary dark:text-white {compact ? 'mt-2 text-xs' : 'mt-3 text-sm'}">
					{sponsor.name}
				</p>
			</a>
		{/each}
		<div
			class="flex w-full items-center justify-center self-center rounded-xl border border-dashed border-link/40 bg-white/50 p-4 text-center dark:bg-slate-900/40 {compact ? 'min-h-[80px]' : 'min-h-[120px]'}"
		>
			<a
				href="mailto:hello@btcmap.org"
				class="text-sm font-semibold uppercase tracking-wide text-link"
				>Become a {tier.level}</a
			>
		</div>
	</div>
</article>
