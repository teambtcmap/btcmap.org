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
			class="z-[2000] border border-mapBorder absolute top-[5vh] md:top-[calc(50vh-200px)] left-[5vw] md:left-[calc(50vw-215px)] h-[90vh] md:h-[400px] w-[90vw] md:w-[430px] bg-white p-6 rounded-xl shadow-2xl"
		>
			<CloseButton
				position="absolute top-5 left-5"
				click={closeModal}
				colors="text-primary hover:text-link"
			/>
			<div class="break-all overflow-auto h-full w-full">
				<pre>
          <code>
{JSON.stringify($showTags, null, 2)}
          </code>
        </pre>
			</div>
		</div>
	</OutClick>
{/if}
