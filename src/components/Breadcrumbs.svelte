<script lang="ts">
	import Icon from '$components/Icon.svelte';
	type Routes = { name: string; url: string }[];
	export let routes: Routes;
</script>

<div
	class="-mx-10 flex w-full flex-wrap items-center gap-3 px-4 py-5 md:mx-auto xl:w-[1200px] xl:px-0"
>
	{#each routes as route, index (index)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={route.url}
			class="text-sm text-link transition-colors hover:text-hover {index === routes.length - 1
				? 'font-bold'
				: 'font-normal'}"
		>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{route.name}
		</a>
		{#if index !== routes.length - 1}
			<Icon type="fa" icon="chevron-right" w="8" h="8" style="text-link" />
		{/if}
	{/each}
</div>
