<script>
	export let click;
	export let icon;
	export let text;
</script>

<button
	on:click={click}
	class="flex h-20 w-24 items-center justify-center rounded-lg border border-primary py-1 !text-primary transition-colors hover:border-link hover:!text-link dark:border-mapBorder dark:!text-white dark:hover:border-link dark:hover:!text-link"
>
	<div>
		<svg width="30px" height="30px" class="mx-auto">
			<use width="30px" height="30px" href="/icons/popup/spritesheet.svg#{icon}" />
		</svg>
		<span class="mt-1 block text-center text-xs font-semibold">{text}</span>
	</div>
</button>
