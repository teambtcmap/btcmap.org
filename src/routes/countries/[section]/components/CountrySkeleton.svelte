<script lang="ts">
import Skeleton from "$components/Skeleton.svelte";
</script>

<div
	class="animate-pulse rounded-3xl border border-link/50 shadow transition-shadow hover:shadow-2xl"
>
	<div class="my-4 space-y-2 p-4">
		<!-- avatar placeholder -->
		<Skeleton class="mx-auto h-20 w-20 rounded-full" />

		<!-- name placeholder -->
		<Skeleton class="mx-auto h-[28px] w-[200px] rounded-xl" />
	</div>
</div>
