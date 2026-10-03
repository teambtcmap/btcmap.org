<script lang="ts">
import Skeleton from "$components/Skeleton.svelte";
</script>

<div
	class="items-center justify-between space-y-2 p-5 md:flex md:space-y-0 md:space-x-5 lg:space-x-0"
>
	<div class="items-center space-y-2 md:flex md:space-y-0 md:space-x-5">
		<!-- dot placeholder -->
		<Skeleton class="mx-auto h-3 w-3 rounded-full md:mx-0" />

		<!-- event placeholder -->
		<Skeleton
			class="mx-auto h-[38px] w-full rounded-xl md:mx-0 md:h-[30px] md:w-[450px]"
		/>
	</div>

	<!-- tipping button placeholder -->
	<Skeleton
		class="mx-auto h-[38px] w-full rounded-lg md:mx-0 md:h-[30px] md:w-20"
	/>
</div>
