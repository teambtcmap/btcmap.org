<script>
	export let value;
	export let text;
	export let showQrToggle;

	import { CopyButton } from '$comp';
</script>

<div>
	<h3 class="hidden md:block uppercase text-body text-lg">
		{text}
		<img
			src={text === 'Lightning' ? '/icons/ln-highlight.svg' : '/icons/btc-highlight.svg'}
			alt="protocol"
			class="inline mb-1"
		/>
	</h3>
	<div
		class="bg-lightBlue text-body rounded-xl py-4 md:py-3 px-4 md:px-0 flex justify-between md:justify-center items-center md:space-x-4 w-full md:w-[475px] mx-auto"
	>
		<!-- value -->
		<span class="hidden md:block lowercase"
			>{text === 'Lightning' ? `${value.slice(0, 41)}...` : value}</span
		>
		<span class="block md:hidden uppercase"
			>{text}
			<img
				src={text === 'Lightning' ? '/icons/ln-highlight.svg' : '/icons/btc-highlight.svg'}
				alt="protocol"
				class="inline mb-1"
			/>
		</span>

		<div class="space-x-4">
			<!-- qr button -->
			<button
				class="text-link hover:text-hover transition-colors"
				on:click={() => showQrToggle(text)}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 448 512"
					fill="currentColor"
					class="w-6 h-6"
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
