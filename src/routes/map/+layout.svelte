<script>
	import { MapLoading } from '$comp';
	import { elements, elementError, mapLoading } from '$lib/store';
</script>

{#if ($elements && $elements.length) || $elementError}
	<slot />
{:else}
	<MapLoading message={$mapLoading} />
{/if}
