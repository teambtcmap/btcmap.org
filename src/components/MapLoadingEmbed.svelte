<script lang="ts">
	export let style: undefined | string = undefined;

	import { LoadingSpinner } from '$lib/comp';
</script>

<div
	class="w-full {style} absolute left-0 top-0 z-[10000] flex items-center justify-center bg-teal dark:bg-dark"
>
	<div class="space-y-6">
		<LoadingSpinner color="text-link" />
		<p class="text-center font-semibold text-primary dark:text-white">Loading map...</p>
	</div>
</div>
