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
			class="absolute top-[5vh] left-[5vw] z-[2000] h-[90vh] w-[90vw] overflow-auto rounded-xl border border-mapBorder bg-white p-6 shadow-2xl md:top-[calc(50vh-200px)] md:left-[calc(50vw-215px)] md:h-[400px] md:w-[430px]"
		>
			<CloseButton
				position="flex justify-end"
				click={closeModal}
				colors="text-primary hover:text-link"
			/>
			<div class="space-y-2">
				{#each Object.entries($showTags) as tag}
					<div>
						<span class="font-semibold text-primary">{tag[0]}</span>=<span
							class="font-semibold text-body">{tag[1]}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</OutClick>
{/if}
