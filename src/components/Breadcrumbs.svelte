<script lang="ts">
	type Routes = { name: string; url: string }[];
	export let routes: Routes;
</script>

<div class="mx-auto flex w-full flex-wrap items-center gap-3 px-4 py-5 xl:w-[1200px] xl:px-0">
	{#each routes as route, index}
		<a
			href={route.url}
			class="text-sm text-link transition-colors hover:text-hover {index === routes.length - 1
				? 'font-bold'
				: 'font-normal'}"
		>
			{route.name}
		</a>
		{#if index !== routes.length - 1}
			<i class="fa-solid fa-chevron-right w-2 text-link" />
		{/if}
	{/each}
</div>
