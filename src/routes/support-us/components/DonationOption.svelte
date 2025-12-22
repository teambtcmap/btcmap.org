<script lang="ts">
	import CopyButton from '$components/CopyButton.svelte';
	import Icon from '$components/Icon.svelte';
	import type { DonationType } from '$lib/types';

	export let value: string;
	export let text: DonationType;
	export let showQrToggle: (type: DonationType) => void;
</script>

<div>
	<h3 class="hidden text-lg text-body uppercase md:block dark:text-white">
		{text}
		<img
			src={text === 'Lightning' ? '/icons/ln-highlight.svg' : '/icons/btc-highlight.svg'}
			alt="protocol"
			class="mb-1 inline dark:rounded-full dark:bg-white dark:p-0.5"
		/>
	</h3>
	<div
		class="mx-auto flex w-full items-center justify-between rounded-xl bg-slate-100 px-4 py-4 text-body md:w-[475px] md:justify-center md:space-x-4 md:px-0 md:py-3 dark:bg-white/[0.15] dark:text-white"
	>
		<!-- value -->
		<span class="hidden lowercase md:block">{value.slice(0, 39)}...</span>
		<span class="block uppercase md:hidden"
			>{text}
			<img
				src={text === 'Lightning' ? '/icons/ln-highlight.svg' : '/icons/btc-highlight.svg'}
				alt="protocol"
				class="mb-1 inline dark:rounded-full dark:bg-white dark:p-0.5"
			/>
		</span>

		<div class="space-x-4">
			<!-- qr button -->
			<button
				class="text-link transition-colors hover:text-hover"
				on:click={() => showQrToggle(text)}
			>
				<Icon type="fa" icon="qrcode" w="24" h="24" />
			</button>

			<!-- copy button -->
			<CopyButton {value} />
		</div>
	</div>
</div>
