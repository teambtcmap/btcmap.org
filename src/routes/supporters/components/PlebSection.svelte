<script lang="ts">
import type { Pleb, SponsorshipTier } from "../sponsors";

export let tier: SponsorshipTier;
export let plebs: Pleb[];
export let ctaHref: string;

const tierStyles: Partial<Record<SponsorshipTier["level"], string>> = {
	Baller:
		"border-yellow-300/70 bg-yellow-50/70 dark:border-yellow-400/40 dark:bg-yellow-500/10",
	Chad: "border-purple-300/70 bg-purple-50/70 dark:border-purple-400/40 dark:bg-purple-500/10",
	Pleb: "border-orange-300/70 bg-orange-50/70 dark:border-orange-400/40 dark:bg-orange-500/10",
};

const initBg: Partial<Record<SponsorshipTier["level"], string>> = {
	Baller:
		"bg-yellow-200 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
	Chad: "bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
	Pleb: "bg-orange-200 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};
</script>

<div
	class="rounded-2xl border p-6 text-left shadow-sm {tierStyles[tier.level] ?? ''}"
>
	<div class="mb-6 space-y-1">
		<h3 class="text-2xl font-bold text-primary dark:text-white">{tier.level}s</h3>
		<p class="text-base text-body/70 dark:text-slate-400">{tier.headline}</p>
	</div>

	<div class="flex flex-wrap items-end gap-4">
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
						class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/60 text-xl font-bold shadow-md dark:border-white/20 {initBg[tier.level] ?? ''}"
					>
						{pleb.name[0]}
					</div>
				{/if}
				<span class="text-xs font-medium text-body dark:text-slate-300">{pleb.name}</span>
			</a>
		{/each}

		<!-- CTA as a circular avatar-sized button at the end -->
		<a
			href={ctaHref}
			target="_blank"
			rel="noreferrer"
			class="group flex flex-col items-center gap-2 transition-transform duration-150 hover:-translate-y-0.5"
			title="Become a Supporter"
		>
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-link/50 bg-white/60 text-2xl font-light text-link shadow-md transition-colors group-hover:border-link group-hover:bg-white dark:bg-slate-900/40 dark:group-hover:bg-slate-900/70"
			>
				+
			</div>
			<span class="text-xs font-medium text-link">Join us</span>
		</a>
	</div>
</div>
