<script>
	export let value;
	export let text;
	export let showQrToggle;

	let copied = false;

	const copy = (field) => {
		navigator.clipboard.writeText(field);
		copied = true;
		setTimeout(() => (copied = false), 2100);
	};
</script>

<div>
	<h3 class="hidden md:block uppercase text-body text-lg">
		{text === 'Lightning' ? text + ' ⚡' : text + ' 🔗'}
	</h3>
	<div
		class="bg-lightBlue text-body rounded-xl py-4 md:py-3 px-4 md:px-0 flex justify-between md:justify-center items-center md:space-x-4 w-full md:w-[475px] mx-auto"
	>
		<!-- value -->
		<span class="hidden md:block lowercase"
			>{text === 'Lightning' ? `${value.slice(0, 41)}...` : value}</span
		>
		<span class="block md:hidden uppercase"
			>{text === 'Lightning' ? text + ' ⚡' : text + ' 🔗'}</span
		>

		<div class="space-x-4">
			<!-- qr button -->
			<button class="text-link hover:text-hover" on:click={() => showQrToggle(text)}>
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
			<button class="text-link hover:text-hover" on:click={() => copy(value)}>
				{#if copied}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 512 512"
						fill="currentColor"
						class="w-6 h-6"
						><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
							d="M470.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L192 338.7 425.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"
						/></svg
					>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 384 512"
						fill="currentColor"
						class="w-6 h-6"
						><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
							d="M192 0c-41.8 0-77.4 26.7-90.5 64H48C21.5 64 0 85.5 0 112V464c0 26.5 21.5 48 48 48H336c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H282.5C269.4 26.7 233.8 0 192 0zm0 128c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm-80 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z"
						/></svg
					>
				{/if}
			</button>
		</div>
	</div>
</div>
