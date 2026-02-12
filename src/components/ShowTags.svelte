<script lang="ts">
import { fly } from "svelte/transition";
import OutClick from "svelte-outclick";

import CloseButton from "$components/CloseButton.svelte";
import { showTags } from "$lib/store";

const closeModal = () => ($showTags = undefined);
</script>

{#if $showTags}
	<OutClick excludeQuerySelectorAll="#show-tags" on:outclick={closeModal}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center-fixed z-[2000] max-h-[90vh] w-[90vw] overflow-auto rounded-xl border border-gray-300 bg-white p-6 text-left shadow-2xl md:h-[400px] md:w-[430px] dark:border-white/95 dark:bg-dark"
		>
			<CloseButton on:click={closeModal} />

			<div class="space-y-2">
				{#each Object.entries($showTags) as tag, index (index)}
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
