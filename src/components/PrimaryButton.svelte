<script>
	export let text;
	export let style;
	export let link = undefined;
	export let click = undefined;
	export let type = undefined;
	export let external = undefined;
	export let disabled = undefined;
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
		{text}
	</button>
{/if}
