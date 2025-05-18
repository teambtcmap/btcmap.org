<script lang="ts">
	import { CommentAdd } from '$lib/comp';
	import { browser } from '$app/environment';

	// import { Icon } from '$lib/comp';
	// import { boost, exchangeRate, resetBoost } from '$lib/store';
	// import type { Element } from '$lib/types';
	// import { errToast } from '$lib/utils';
	// import axios from 'axios';
	// import axiosRetry from 'axios-retry';

	// export let merchant: Element | undefined;
	// export let boosted: string | undefined;
	// export let style: 'button' | 'link' = 'button';

	// axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

	// let boostLoading = false;

	// const resetBoostLoading = () => {
	// 	boostLoading = false;
	// };

	let open = false;

	const openCommentModal = () => {
		console.log('openCommentModal');
		open = true;

		// 	if (!merchant) return;

		// 	boostLoading = true;

		// 	$boost = {
		// 		id: merchant.id,
		// 		name: merchant.osm_json.tags?.name || '',
		// 		boost: boosted || ''
		// 	};

		// 	axios
		// 		.get('https://blockchain.info/ticker')
		// 		.then(function (response) {
		// 			$exchangeRate = response.data['USD']['15m'];
		// 		})
		// 		.catch(function (error) {
		// 			errToast('Could not fetch bitcoin exchange rate, please try again or contact BTC Map.');
		// 			console.error(error);
		// 			resetBoostLoading();
		// 		});
	};

	// $: $resetBoost && resetBoostLoading();
</script>

<button
	on:click={openCommentModal}
	disabled={false}
	class="{'bg-link hover:bg-hover'} mx-auto flex w-40 items-center justify-center rounded-xl p-3 text-center font-semibold text-white transition-colors"
>
	Add comment -> open {open}
</button>

{#if browser}
	<CommentAdd bind:open />
{/if}
