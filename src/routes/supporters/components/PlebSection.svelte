<script lang="ts">
import type { Pleb, SponsorshipTier } from "../sponsors";

export let tier: SponsorshipTier;
export let plebs: Pleb[];
export let ctaHref: string;
</script>

<div
	class="rounded-2xl border border-orange-300/70 bg-orange-50/70 p-6 text-left shadow-sm dark:border-orange-400/40 dark:bg-orange-500/10"
>
	<div class="mb-6 space-y-1">
		<h3 class="text-2xl font-bold text-primary dark:text-white">{tier.level} tier</h3>
		<p class="text-2xl text-body/70 dark:text-slate-400">{tier.headline}</p>
	</div>

	{#if plebs.length > 0}
		<div class="flex flex-wrap gap-4">
			{#each plebs as pleb (pleb.name)}
				<a
					href={pleb.url ?? '#'}
					target={pleb.url ? '_blank' : undefined}
					rel="noreferrer"
					class="group flex flex-col items-center gap-2 transition-transform duration-150 hover:-translate-y-0.5"
				>
					{#if pleb.avatar}
						<img
							src={pleb.avatar}
							alt={pleb.name}
							class="h-16 w-16 rounded-full border-2 border-white/60 object-cover shadow-md group-hover:border-link dark:border-white/20"
						/>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/60 bg-orange-200 text-xl font-bold text-orange-700 shadow-md dark:border-white/20 dark:bg-orange-900/40 dark:text-orange-300"
						>
							{pleb.name[0]}
						</div>
					{/if}
					<span class="text-xs font-medium text-body dark:text-slate-300">{pleb.name}</span>
				</a>
			{/each}
		</div>
	{/if}

	<div class="mt-6">
		<a
			href={ctaHref}
			target="_blank"
			rel="noreferrer"
			class="inline-block rounded-xl border border-link/40 bg-white/60 px-5 py-2.5 text-sm font-semibold text-link transition-colors hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
		>
			Become a Supporter
		</a>
	</div>
</div>
