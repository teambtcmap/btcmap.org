<script>
	export let text;
	export let style;
	export let link = undefined;
	export let click = undefined;
	export let type = undefined;
	export let external = undefined;
	export let disabled = undefined;
	export let loading = undefined;
</script>

{#if link}
	<a
		href={link}
		target={external ? '_blank' : '_self'}
		rel={external ? 'noreferrer' : ''}
		class="block bg-link hover:bg-hover text-white text-center font-semibold rounded-xl {style}"
	>
		{text}
	</a>
{:else}
	<button
		on:click={click}
		{type}
		{disabled}
		class="block bg-link hover:bg-hover text-white text-center font-semibold rounded-xl {style}"
	>
		{#if loading}
			<svg
				class="animate-spin h-6 w-6 text-white mx-auto"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		{:else}
			{text}
		{/if}
	</button>
{/if}
