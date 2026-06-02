<script lang="ts">
import Icon from "$components/Icon.svelte";
import SaveButton from "$components/SaveButton.svelte";
import { _ } from "$lib/i18n";

import MerchantStaticMap from "./MerchantStaticMap.svelte";
import { browser } from "$app/environment";

// Compact identity hero: app bar (back · breadcrumb · Save) over a
// non-interactive map preview with the name/address overlaid on a scrim.
export let id: string | number;
export let name: string;
export let address: string | undefined = undefined;
// Already-resolved Material icon name for the category marker.
export let icon: string;
export let lat: number;
export let long: number;
export let boosted = false;
export let deleted = false;

const goBack = () => {
	if (browser && window.history.length > 1) {
		window.history.back();
	}
};
</script>

<section class="overflow-hidden rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/5">
	<!-- app bar -->
	<div class="flex items-center gap-2 border-b border-gray-300 px-3 py-2 dark:border-white/20">
		<button
			type="button"
			on:click={goBack}
			aria-label={$_('aria.back')}
			class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-primary transition-colors hover:border-link hover:text-link dark:border-white/20 dark:text-white"
		>
			<Icon w="18" h="18" icon="chevron_left" type="material" />
		</button>
		<span class="min-w-0 flex-1 truncate text-center text-xs text-body dark:text-white/60">
			btcmap.org / {id}
		</span>
		{#if !deleted}
			<SaveButton id={Number(id)} type="place" class="!mx-0 !w-auto shrink-0 px-3" />
		{/if}
	</div>

	<!-- map preview + identity overlay -->
	<div class="relative h-44">
		<MerchantStaticMap {lat} {long} />

		<a
			href={`/map#18/${lat}/${long}&merchant=${id}`}
			class="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur transition-colors hover:text-link dark:border-white/20 dark:bg-black/40 dark:text-white"
		>
			{$_('info.viewOnMainMap')}
			<svg class="w-3" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M3 13L13 3M13 3H5.5M13 3V10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</a>

		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-white via-white/85 to-transparent px-4 pt-12 pb-4 dark:from-[#0f0f10] dark:via-[#0f0f10]/70"
		>
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-2 ring-white dark:ring-[#0f0f10] {deleted
					? 'bg-gray-400 dark:bg-gray-600'
					: boosted
						? 'bg-bitcoin'
						: 'bg-link'}"
			>
				<Icon w="26" h="26" class="text-white" {icon} type="material" />
			</div>
			<div class="min-w-0">
				<h1 class="truncate text-2xl leading-tight font-semibold text-primary dark:text-white">
					{name}
					{#if deleted}
						<span class="text-base text-red-600 dark:text-red-400">(Deleted)</span>
					{/if}
				</h1>
				{#if address}
					<p class="truncate text-sm text-body dark:text-white/70">{address}</p>
				{/if}
			</div>
		</div>
	</div>
</section>
