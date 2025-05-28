<div class="animate-pulse grid-cols-6 border-b border-link/50 py-5 text-center lg:grid">
	<!-- position placeholder -->
	<span class="mx-auto my-auto block h-5 w-5 animate-pulse rounded-full bg-link/50 lg:inline" />

	<!-- avatar and name placeholder -->
	<div class="my-5 lg:my-0">
		<!-- avatar -->
		<span
			class="mx-auto mb-2 block h-20 w-20 animate-pulse rounded-full bg-link/50 lg:h-14 lg:w-14"
		/>

		<!-- name -->
		<span
			class="mx-auto block h-[30px] w-[150px] animate-pulse rounded-xl bg-link/50 lg:w-[100px]"
		/>
	</div>

	<!-- stats placeholders -->
	<span
		class="mx-auto my-2 block h-5 w-[100px] animate-pulse bg-link/50 lg:my-auto lg:inline-block"
	/>
	<span
		class="mx-auto my-2 block h-5 w-32 animate-pulse rounded-xl bg-link/50 lg:my-auto lg:inline-block lg:w-5 lg:rounded-full"
	/>
	<span
		class="mx-auto my-2 block h-5 w-32 animate-pulse rounded-xl bg-link/50 lg:my-auto lg:inline-block lg:w-5 lg:rounded-full"
	/>
	<div class="my-2 flex items-center justify-center space-x-1 lg:my-0 lg:inline-flex">
		{#each Array(5) as _, index (index)}
			<i class="fa-solid fa-star animate-pulse text-lg text-link/50" />
		{/each}
	</div>
</div>
