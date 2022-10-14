<script>
	import { elements, mapError, reportShowMap } from '$lib/store';
</script>

{#if ($elements && $elements.length) || $mapError || !$reportShowMap}
	<slot />
{/if}
