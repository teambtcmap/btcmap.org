<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { boost, exchangeRate, resetBoost } from '$lib/store';
	import type { Place } from '$lib/types';
	import { fetchExchangeRate } from '$lib/utils';
	import axios from 'axios';
	import axiosRetry from 'axios-retry';

	export let merchant: Place | undefined;
	export let boosted: string | undefined;
	export let style: 'button' | 'link' = 'button';

	axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

	let boostLoading = false;

	const resetBoostLoading = () => {
		boostLoading = false;
	};

	const startBoost = async () => {
		if (!merchant) return;

		boostLoading = true;

		$boost = {
			id: merchant.id,
			name: merchant.name || '',
			boost: boosted || ''
		};

		try {
			$exchangeRate = await fetchExchangeRate();
		} catch {
			resetBoostLoading();
		}
	};

	$: $resetBoost && resetBoostLoading();
</script>

{#if style === 'button'}
	<button
		id="boost-button"
		on:click={startBoost}
		disabled={boostLoading}
		class="{boosted
			? 'hover:bg-bitcoinHover bg-bitcoin'
			: 'bg-link hover:bg-hover'} mx-auto flex w-40 items-center justify-center rounded-xl p-3 text-center font-semibold text-white transition-colors"
	>
		<Icon
			w="20"
			h="20"
			style="text-white mr-1"
			icon={boosted ? 'boost-solid' : 'boost'}
			type="popup"
		/>
		{boostLoading ? 'Boosting...' : boosted ? 'Extend Boost' : 'Boost'}
	</button>
{:else}
	<button
		id="boost-button"
		on:click={startBoost}
		disabled={boostLoading || Boolean($boost)}
		class="inline-flex items-center space-x-1 font-semibold text-link transition-colors hover:text-hover"
	>
		<Icon w="16" h="16" icon="boost" style="shrink-0" type="popup" />
		<p class="text-sm">{boostLoading ? 'Boosting...' : boosted ? 'Extend Boost' : 'Boost'}</p>
	</button>
{/if}
