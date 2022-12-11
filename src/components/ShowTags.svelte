<script>
	import OutClick from 'svelte-outclick';
	import { showTags } from '$lib/store';
	import { fly } from 'svelte/transition';
	import { CloseButton } from '$comp';

	const closeModal = () => ($showTags = undefined);
</script>

{#if $showTags}
	<OutClick excludeByQuerySelector={['#show-tags']} on:outclick={closeModal}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="z-[2000] border border-mapBorder absolute top-[5vh] md:top-[calc(50vh-200px)] left-[5vw] md:left-[calc(50vw-215px)] h-[90vh] md:h-[400px] w-[90vw] md:w-[430px] bg-white p-6 rounded-xl shadow-2xl overflow-auto"
		>
			<CloseButton
				position="flex justify-end"
				click={closeModal}
				colors="text-primary hover:text-link"
			/>
			<div class="space-y-2">
				{#each Object.entries($showTags) as tag}
					<div>
						<span class="text-primary font-semibold">{tag[0]}</span>=<span
							class="text-body font-semibold">{tag[1]}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</OutClick>
{/if}
