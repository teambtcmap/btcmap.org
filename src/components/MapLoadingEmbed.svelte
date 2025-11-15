<script lang="ts">
	export let style: undefined | string = undefined;

	import LoadingSpinner from '$components/LoadingSpinner.svelte';
</script>

<div
	class="w-full {style} absolute top-0 left-0 z-[25] flex items-center justify-center bg-teal dark:bg-dark"
>
	<div class="space-y-6">
		<LoadingSpinner color="text-link" />
		<p class="text-center font-semibold text-primary dark:text-white">Loading map...</p>
	</div>
</div>
