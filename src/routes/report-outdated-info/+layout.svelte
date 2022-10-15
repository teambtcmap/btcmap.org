<script>
	import { elements, elementError, reportShowMap } from '$lib/store';
</script>

{#if ($elements && $elements.length) || $elementError || !$reportShowMap}
	<slot />
{/if}
