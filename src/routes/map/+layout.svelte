<script>
	import { elements, mapError } from '$lib/store';
</script>

{#if ($elements && $elements.length) || $mapError}
	<slot />
{/if}
