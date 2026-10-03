<script lang="ts">
import Skeleton from "$components/Skeleton.svelte";
</script>

<div
	class="grid-cols-6 space-y-5 border-t border-b border-link/50 py-5 text-center lg:grid lg:space-y-0 lg:border-none lg:py-0 dark:border-white/10"
>
	<!-- position placeholder -->
	<Skeleton as="span" class="mx-auto my-auto block h-5 w-5 rounded-full lg:inline" />

	<!-- avatar and username placeholder -->
	<div class="items-center space-y-2 lg:flex lg:space-y-0 lg:space-x-2">
		<!-- avatar -->
		<Skeleton
			as="span"
			class="mx-auto block h-20 w-20 rounded-full lg:mx-0 lg:inline lg:h-14 lg:w-14"
		/>

		<!-- username -->
		<Skeleton
			as="span"
			class="mx-auto block h-[30px] w-[150px] rounded-xl lg:mx-0 lg:inline lg:w-[75px] xl:w-[100px]"
		/>
	</div>

	<!-- stats placeholders -->
	{#each Array(3) as _, index (index)}
		<Skeleton
			as="span"
			class="mx-5 inline-block h-3 w-3 rounded-full lg:mx-auto lg:!my-auto lg:h-5 lg:w-5"
		/>
	{/each}

	<!-- tip button placeholder -->
	<Skeleton
		class="mx-auto h-[38px] w-full rounded-lg md:h-[30px] md:w-20 lg:!my-auto"
	/>
</div>
