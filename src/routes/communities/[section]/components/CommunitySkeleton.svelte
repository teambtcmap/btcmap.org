<script lang="ts">
import Skeleton from "$components/Skeleton.svelte";
</script>

<div
	class="rounded-3xl border border-link/50 shadow transition-shadow hover:shadow-2xl"
>
	<div class="my-4 space-y-2 p-4">
		<!-- avatar placeholder -->
		<Skeleton class="mx-auto h-20 w-20 rounded-full" />

		<!-- name placeholder -->
		<Skeleton class="mx-auto h-[28px] w-[200px] rounded-xl" />
	</div>

	<!-- socials placeholder -->
	<div
		class="flex w-full items-center justify-center space-x-2 border-t border-t-link/50 p-4"
	>
		<Skeleton class="h-[40px] w-[40px] rounded-full" />
		<Skeleton class="h-[40px] w-[40px] rounded-full" />
		<Skeleton class="h-[40px] w-[40px] rounded-full" />
	</div>
</div>
