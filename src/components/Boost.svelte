<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { CloseButton } from '$lib/comp';
	import { boost, exchangeRate, resetBoost, lastUpdatedPlaceId } from '$lib/store';
	import OutClick from 'svelte-outclick';
	import { fly } from 'svelte/transition';
	import BoostContent from './drawer/BoostContent.svelte';

	let boostComplete = false;
	
	const closeModal = () => {
		if (boostComplete) {
			invalidateAll();
		}
		$boost = undefined;
		$exchangeRate = undefined;
		$resetBoost = $resetBoost + 1;
		$lastUpdatedPlaceId = undefined;
		boostComplete = false;
	};

	const handleOutClick = () => {
		// Never close the boost modal on outside clicks to prevent accidental loss of progress
	};

	const handleBoostComplete = () => {
		boostComplete = true;
	};
</script>

{#if $boost && $exchangeRate}
	<OutClick on:outclick={handleOutClick}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center-fixed z-[2000] max-h-[90vh] w-[90vw] overflow-auto rounded-xl border border-gray-300 bg-white p-6 text-left shadow-2xl md:w-[430px] dark:border-white/95 dark:bg-dark"
		>
			<CloseButton on:click={closeModal} />

			<BoostContent
				merchantId={$boost.id}
				merchantName={$boost.name}
				onComplete={handleBoostComplete}
			/>
		</div>
	</OutClick>
{/if}
