<script lang="ts">
	import { Icon } from '$lib/comp';
	import { boost, exchangeRate, resetBoost } from '$lib/store';
	import type { Element } from '$lib/types';
	import { errToast } from '$lib/utils';
	import axios from 'axios';
	import axiosRetry from 'axios-retry';

	export let merchant: Element | undefined;
	export let boosted: string | undefined;
	export let style: 'button' | 'link' = 'button';

	axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

	let boostLoading = false;

	const resetBoostLoading = () => {
		boostLoading = false;
	};

	const startBoost = () => {
		if (!merchant) return;

		boostLoading = true;

		$boost = {
			id: merchant.id,
			name: merchant.osm_json.tags?.name || '',
			boost: boosted || ''
		};

		axios
			.get('https://blockchain.info/ticker')
			.then(function (response) {
				$exchangeRate = response.data['USD']['15m'];
			})
			.catch(function (error) {
				errToast('Could not fetch bitcoin exchange rate, please try again or contact BTC Map.');
				console.log(error);
				resetBoostLoading();
			});
	};

	$: $resetBoost && resetBoostLoading();
</script>

{#if style === 'button'}
	<button
		id="boost-button"
		on:click={startBoost}
		disabled={boostLoading}
		class="{boosted
			? 'bg-bitcoin hover:bg-bitcoinHover'
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
		<Icon w="16" h="16" icon="boost" type="popup" style="shrink-0" />
		<p class="text-sm">{boostLoading ? 'Boosting...' : boosted ? 'Extend Boost' : 'Boost'}</p>
	</button>
{/if}
