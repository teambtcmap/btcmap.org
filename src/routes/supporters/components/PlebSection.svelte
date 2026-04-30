<script lang="ts">
import type { Pleb, SponsorshipTier } from "../sponsors";

export let tier: SponsorshipTier;
export let plebs: Pleb[];
export let ctaHref: string;

const tierStyles: Partial<Record<SponsorshipTier["level"], string>> = {
	Pleb: "border-orange-300/70 bg-orange-50/70 dark:border-orange-400/40 dark:bg-orange-500/10",
};

const initBg: Partial<Record<SponsorshipTier["level"], string>> = {
	Pleb: "bg-orange-200 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

let activeTooltip: string | null = null;

function toggleTooltip(name: string, e: MouseEvent | TouchEvent) {
	e.preventDefault();
	activeTooltip = activeTooltip === name ? null : name;
}

function handleClickOutside(e: MouseEvent) {
	if (
		activeTooltip &&
		!(e.target as Element).closest("[data-tooltip-anchor]")
	) {
		activeTooltip = null;
	}
}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="rounded-2xl border p-6 text-left shadow-sm {tierStyles[tier.level] ?? ''}">
	<div class="mb-6 space-y-1">
		<h3 class="text-2xl font-bold text-primary dark:text-white">{tier.level}s</h3>
		<p class="text-base text-body/70 dark:text-slate-400">{tier.headline}</p>
	</div>

	<div class="flex flex-wrap justify-center gap-4">
		{#each plebs as pleb (pleb.name)}
			<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
			<div
				data-tooltip-anchor
				class="relative"
				on:click={(e) => toggleTooltip(pleb.name, e)}
				on:touchend={(e) => toggleTooltip(pleb.name, e)}
			>
				<a
					href={pleb.url ?? "#"}
					target={pleb.url ? "_blank" : undefined}
					rel="noreferrer"
					class="block transition-transform duration-150 hover:-translate-y-0.5"
					on:click={(e) => {
						if (activeTooltip !== pleb.name) e.preventDefault();
					}}
				>
					{#if pleb.avatar}
						<img
							src={pleb.avatar}
							alt={pleb.name}
							class="h-16 w-16 rounded-full border-2 border-white/60 object-cover shadow-md dark:border-white/20 {activeTooltip === pleb.name ? 'border-link' : ''}"
						/>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/60 text-xl font-bold shadow-md dark:border-white/20 {initBg[tier.level] ?? ''}"
						>
							{pleb.name[0]}
						</div>
					{/if}
				</a>
				{#if activeTooltip === pleb.name}
					<span
						class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-center text-xs text-white dark:bg-gray-700"
					>
						<span class="block font-medium">{pleb.name}</span>
						{#if pleb.sats}
							<span class="block opacity-75">{pleb.sats.toLocaleString()} sats</span>
						{/if}
					</span>
				{/if}
			</div>
		{/each}

		<!-- CTA -->
		<a
			href={ctaHref}
			target="_blank"
			rel="noreferrer"
			class="group relative transition-transform duration-150 hover:-translate-y-0.5"
		>
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-link/50 bg-white/60 text-2xl font-light text-link shadow-md transition-colors group-hover:border-link group-hover:bg-white dark:bg-slate-900/40 dark:group-hover:bg-slate-900/70"
			>
				+
			</div>
		</a>
	</div>

	<div
		class="mt-6 flex items-center justify-center gap-2 border-t border-black/10 pt-4 dark:border-white/10"
	>
		<span class="text-xs text-body/50 dark:text-slate-500">Powered by</span>
		<a
			href="https://geyser.fund/project/btcmap"
			target="_blank"
			rel="noreferrer"
			class="flex items-center gap-1.5 opacity-50 transition-opacity hover:opacity-80"
		>
			<img src="https://geyser.fund/logo-brand.svg" alt="Geyser" class="h-4 w-auto" />
		</a>
	</div>
</div>
