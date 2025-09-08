<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	export let link: string;
	export let icon: string;
	export let text: string;
</script>

<a
	href={link}
	target="_blank"
	rel="noreferrer"
	class="flex h-20 w-24 items-center justify-center rounded-lg border border-primary py-1 !text-primary transition-colors hover:border-link hover:!text-link dark:border-mapBorder dark:!text-white dark:hover:border-link dark:hover:!text-link"
>
	<div>
		<svg width="30px" height="30px" class="mx-auto">
			<use width="30px" height="30px" href="/icons/spritesheet-popup.svg#{icon}" />
		</svg>
		<span class="mt-1 block text-center text-xs font-semibold">{text}</span>
	</div>
</a>
