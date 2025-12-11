<script lang="ts">
	import Icon from '$components/Icon.svelte';

	export let icon: string;
	export let text: string;

	// Map popup spritesheet icon names to material icons
	const iconMap: Record<string, string> = {
		share: 'share',
		tags: 'sell',
		issues: 'warning'
	};

	$: materialIcon = iconMap[icon] || icon;
</script>

<button
	on:click
	class="flex h-20 min-w-24 items-center justify-center rounded-lg border border-primary py-1 !text-primary transition-colors hover:border-link hover:!text-link dark:border-white/95 dark:!text-white dark:hover:border-link dark:hover:!text-link"
>
	<div>
		<Icon w="30" h="30" icon={materialIcon} type="material" class="mx-auto" />
		<span class="mt-1 block text-center text-xs font-semibold">{text}</span>
	</div>
</button>
