<div class="text-center py-5 border-b border-link/50 animate-pulse lg:grid grid-cols-6">
	<!-- position placeholder -->
	<span class="block lg:inline bg-link/50 animate-pulse h-5 w-5 rounded-full my-auto mx-auto" />

	<!-- avatar and name placeholder -->
	<div class="my-5 lg:my-0">
		<!-- avatar -->
		<span
			class="block bg-link/50 animate-pulse w-20 h-20 lg:w-14 lg:h-14 rounded-full mx-auto mb-2"
		/>

		<!-- name -->
		<span
			class="block bg-link/50 animate-pulse w-[150px] lg:w-[100px] h-[30px] rounded-xl mx-auto"
		/>
	</div>

	<!-- stats placeholders -->
	<span
		class="bg-link/50 animate-pulse w-[100px] h-5 lg:!my-auto mx-auto block lg:inline-block my-2 lg:my-0"
	/>
	<span
		class="bg-link/50 animate-pulse w-32 h-5 lg:w-5 rounded-xl lg:rounded-full lg:!my-auto mx-auto block lg:inline-block my-2 lg:my-0"
	/>
	<span
		class="bg-link/50 animate-pulse w-32 h-5 lg:w-5 rounded-xl lg:rounded-full lg:!my-auto mx-auto block lg:inline-block my-2 lg:my-0"
	/>
	<div class="flex lg:inline-flex justify-center items-center space-x-1 my-2 lg:my-0">
		{#each Array(5) as star}
			<i class="text-link/50 text-lg animate-pulse fa-solid fa-star" />
		{/each}
	</div>
</div>
