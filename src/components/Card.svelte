<script lang="ts">
	// we could get rid of this if we use container queries: https://tailwindcss.com/docs/responsive-design#container-queries
	// but we would need to migrate to tailwindcss v4
	export let headerAlign: 'center' | 'responsive' = 'responsive';
</script>

<!-- prettier-ignore -->
<div class="flex w-full flex-col rounded-3xl border border-statBorder dark:border-white/20 dark:bg-white/10">
	<!-- prettier-ignore -->
	<div
		class="border-b border-statBorder p-5 text-lg font-semibold text-primary dark:border-white/20 dark:text-white {headerAlign ===
		'center'
			? 'text-center'
			: 'text-center lg:text-left'}"
	>
		<slot name="header" />
	</div>

	<div class="flex flex-1 flex-col justify-between gap-4">
		<div class="flex flex-col items-center gap-4">
			<slot name="body" />
		</div>

		{#if $$slots.footer}
			<div class="flex justify-center pb-4">
				<slot name="footer" />
			</div>
		{/if}
	</div>
</div>
