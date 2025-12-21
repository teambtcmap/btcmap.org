<script lang="ts">
	import type { AppIconName } from '$lib/icons/types';
	import IconApps from '$lib/icons/IconApps.svelte';

	export let image: AppIconName;
	export let text: string;
	export let desc: string;
	export let link: string;
</script>

<div>
	{#if link}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={link}
			target={text === 'Web' ? null : '_blank'}
			rel={text === 'Web' ? null : 'noreferrer'}
			class="text-2xl font-semibold text-link transition-colors hover:text-hover"
		>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<div
				class="mb-5 flex h-60 items-center justify-center rounded-2xl bg-offwhite dark:bg-white/[0.15]"
			>
				<IconApps w="112" h="112" icon={image} />
			</div>
			<p>{text}</p>
			<p class="text-xl font-normal">{desc}</p>
		</a>
	{:else}
		<div
			class="mb-5 flex h-60 items-center justify-center rounded-2xl bg-offwhite text-link opacity-50 dark:bg-white/[0.15]"
		>
			<i class="{image} h-28 w-28" />
		</div>
		<p class="text-2xl font-semibold text-link opacity-50">{text}</p>
		<p class="text-xl text-link opacity-50">Soon!</p>
	{/if}
</div>
