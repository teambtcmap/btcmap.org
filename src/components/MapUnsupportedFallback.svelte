<script lang="ts">
// Rendered in place of a MapLibre map container when the browser cannot
// supply a WebGL context. Fills its parent so it matches the map's slot
// in whatever layout hosts it.
</script>

<div
	class="absolute top-0 left-0 z-[25] flex h-full w-full flex-col items-center justify-center gap-3 bg-teal p-6 text-center dark:bg-dark"
	role="status"
	aria-live="polite"
>
	<h2 class="text-lg font-semibold text-primary dark:text-white">
		Map unavailable
	</h2>
	<p class="max-w-md text-sm text-primary dark:text-white">
		Your browser doesn't support WebGL, which is required to display the
		interactive map. Try updating your browser, enabling hardware
		acceleration, or switching to a recent version of Chrome, Firefox, or
		Safari.
	</p>
</div>
