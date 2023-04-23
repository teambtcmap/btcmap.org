<script>
	import OutClick from 'svelte-outclick';
	import { showTags } from '$lib/store';
	import { fly } from 'svelte/transition';
	import { CloseButton } from '$comp';

	const closeModal = () => ($showTags = undefined);
</script>

{#if $showTags}
	<OutClick excludeQuerySelectorAll={['#show-tags']} on:outclick={closeModal}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center-fixed z-[2000] max-h-[90vh] w-[90vw] overflow-auto rounded-xl border border-mapBorder bg-white p-6 text-left shadow-2xl dark:bg-dark md:h-[400px] md:w-[430px]"
		>
			<CloseButton
				position="flex justify-end"
				click={closeModal}
				colors="text-primary dark:text-white dark:hover:text-white/80 hover:text-link"
			/>
			<div class="space-y-2">
				{#each Object.entries($showTags) as tag}
					<div>
						<span class="font-semibold text-primary dark:font-normal dark:text-white">{tag[0]}</span
						><span class="dark:text-white">=</span><span
							class="font-semibold text-body dark:text-white">{tag[1]}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</OutClick>
{/if}
