<script lang="ts">
	export let value: string;
	export let text: DonationType;
	export let showQrToggle: (type: DonationType) => void;

	import { CopyButton } from '$lib/comp';
	import type { DonationType } from '$lib/types';
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
		class="bg-lightBlue mx-auto flex w-full items-center justify-between rounded-xl px-4 py-4 text-body md:w-[475px] md:justify-center md:space-x-4 md:px-0 md:py-3 dark:bg-white/[0.15] dark:text-white"
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
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 448 512"
					fill="currentColor"
					class="h-6 w-6"
					><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
						d="M48 32C21.5 32 0 53.5 0 80v96c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48H48zm80 64v64H64V96h64zM48 288c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48V336c0-26.5-21.5-48-48-48H48zm80 64v64H64V352h64zM256 80v96c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48H304c-26.5 0-48 21.5-48 48zm64 16h64v64H320V96zm32 352v32h32V448H352zm96 0H416v32h32V448zM416 288v32H352V288H256v96 96h64V384h32v32h96V352 320 288H416z"
					/></svg
				>
			</button>

			<!-- copy button -->
			<CopyButton {value} />
		</div>
	</div>
</div>
