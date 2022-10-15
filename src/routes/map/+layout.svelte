<script>
	import { elements, elementError } from '$lib/store';
</script>

{#if ($elements && $elements.length) || $elementError}
	<slot />
{/if}
