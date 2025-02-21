<script lang="ts">
	interface Props {
		click: () => void;
		icon: string;
		text: string;
	}

	let { click, icon, text }: Props = $props();
</script>

<button
	onclick={click}
	class="flex h-20 min-w-24 items-center justify-center rounded-lg border border-primary py-1 !text-primary transition-colors hover:border-link hover:!text-link dark:border-mapBorder dark:!text-white dark:hover:border-link dark:hover:!text-link"
>
	<div>
		<svg width="30px" height="30px" class="mx-auto">
			<use width="30px" height="30px" href="/icons/popup/spritesheet.svg#{icon}" />
		</svg>
		<span class="mt-1 block text-center text-xs font-semibold">{text}</span>
	</div>
</button>
