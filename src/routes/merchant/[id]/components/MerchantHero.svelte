<script lang="ts">
import Icon from "$components/Icon.svelte";
import SaveButton from "$components/SaveButton.svelte";
import { _ } from "$lib/i18n";
import { buildMerchantMapHref } from "$lib/merchantDrawerHash";

import MerchantStaticMap from "./MerchantStaticMap.svelte";

// Compact identity hero: a non-interactive map preview with Save +
// "View on main map" overlaid on top and the name/address on a scrim below.
export let id: string | number;
export let name: string;
export let address: string | undefined = undefined;
// Already-resolved Material icon name for the category marker.
export let icon: string;
export let lat: number;
export let long: number;
export let boosted = false;
export let deleted = false;
</script>

<section class="overflow-hidden rounded-3xl border border-gray-300 dark:border-white/20 dark:bg-white/5">
	<div class="relative h-52">
		<MerchantStaticMap {lat} {long} />

		<!-- location marker, centred on the merchant -->
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 z-[1] -translate-x-1/2 -translate-y-full drop-shadow-md"
		>
			<svg width="30" height="38" viewBox="0 0 32 40" class={deleted ? 'text-gray-500' : boosted ? 'text-bitcoin' : 'text-link'}>
				<path
					d="M16 1C8.27 1 2 7.27 2 15c0 9.5 14 24 14 24s14-14.5 14-24C30 7.27 23.73 1 16 1z"
					fill="currentColor"
					stroke="#fff"
					stroke-width="1.5"
				/>
				<circle cx="16" cy="15" r="5" fill="#fff" />
			</svg>
		</div>

		{#if !deleted}
			<div class="absolute top-3 left-3 z-10">
				<SaveButton id={Number(id)} type="place" class="!mx-0 !w-auto shadow-md" />
			</div>
		{/if}

		<a
			href={buildMerchantMapHref(id, lat, long)}
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
