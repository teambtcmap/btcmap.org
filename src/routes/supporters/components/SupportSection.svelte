<script lang="ts">
import { theme } from "$lib/theme";

import type { Sponsor, SponsorshipTier } from "../sponsors";

export let tier: SponsorshipTier;
export let sponsors: Sponsor[];
export let compact = false;

const levelStyles: Partial<Record<SponsorshipTier["level"], string>> = {
	Explorer:
		"border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-400/40 dark:bg-emerald-500/10",
	Wayfinder:
		"border-sky-300/70 bg-sky-50/70 dark:border-sky-400/40 dark:bg-sky-500/10",
	Cartographer:
		"border-amber-300/70 bg-amber-50/70 dark:border-amber-400/40 dark:bg-amber-500/10",
	Navigator:
		"border-indigo-300/70 bg-indigo-50/70 dark:border-indigo-400/40 dark:bg-indigo-500/10",
	Pioneer:
		"border-rose-300/70 bg-rose-50/70 dark:border-rose-400/40 dark:bg-rose-500/10",
};

$: cardStyle = levelStyles[tier.level] ?? "";
</script>

<article class="rounded-2xl border p-6 text-left shadow-sm {cardStyle}">
	<div class="mb-6 space-y-1">
		<h3 class="{compact ? 'text-xl' : 'text-2xl'} font-bold text-primary dark:text-white">{tier.level}s</h3>
		<p class="text-sm text-body/70 dark:text-slate-400">{tier.headline}</p>
	</div>

	<div class="mx-auto w-full {compact ? 'grid-cols-2' : 'grid-cols-3'} gap-6 space-y-6 lg:grid lg:space-y-0">
		{#each sponsors as sponsor (sponsor.url)}
			<a
				href={sponsor.url}
				target="_blank"
				rel="noreferrer"
				class="mx-auto block w-full self-center rounded-xl border border-white/40 bg-white/60 p-3 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900/40 {compact ? 'md:w-[180px]' : 'md:w-[250px] p-4'}"
			>
				{#if sponsor.icon && typeof window !== 'undefined'}
					<img
						src="{sponsor.iconDark
							? $theme === 'dark'
								? sponsor.iconDark
								: sponsor.icon
							: sponsor.icon}"
						alt={sponsor.name}
						class="mx-auto {compact ? 'h-[60px]' : 'h-[90px]'} w-auto object-contain"
					/>
				{:else}
					<div
						class="mx-auto flex {compact ? 'h-[60px] text-lg' : 'h-[90px] text-2xl'} w-full items-center justify-center rounded-lg border border-dashed border-link/35 px-3 text-center font-semibold text-primary dark:text-white"
					>
						{sponsor.name}
					</div>
				{/if}
				<p class="{compact ? 'mt-2 text-xs' : 'mt-3 text-sm'} text-center font-medium text-primary dark:text-white">
					{sponsor.name}
				</p>
			</a>
		{/each}
		<div
			class="mx-auto flex {compact ? 'min-h-[80px] md:w-[180px]' : 'min-h-[120px] md:w-[250px]'} w-full items-center justify-center self-center rounded-xl border border-dashed border-link/40 bg-white/50 p-6 text-center dark:bg-slate-900/40"
		>
			<a
				href="mailto:hello@btcmap.org"
				class="text-sm font-semibold uppercase tracking-wide text-link"
				>Become a {tier.level}</a
			>
		</div>
	</div>
</article>
