<script>
	export let text;
	export let link = undefined;
	export let style;
	export let click = undefined;
	export let type = undefined;
	export let external = undefined;
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
		class="block bg-link hover:bg-hover text-white text-center font-semibold rounded-xl {style}"
	>
		{text}
	</button>
{/if}
