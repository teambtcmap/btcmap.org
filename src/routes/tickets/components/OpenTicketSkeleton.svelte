<script lang="ts">
import Icon from "$components/Icon.svelte";
import Skeleton from "$components/Skeleton.svelte";
</script>

<div
	class="border-t-statBorder w-full items-center justify-between space-y-1 border-t p-5 text-center md:flex md:space-y-0 md:text-left"
>
	<div class="items-center space-y-1 md:flex md:space-y-0 md:space-x-2">
		<Icon type="fa" icon="ticket" w="20" h="20" class="animate-pulse text-xl text-link/50" />

		<div>
			<Skeleton as="span" class="mr-1 inline-block h-6 w-32 rounded" />

			<span class="block items-center md:inline-flex">
				<Skeleton
					as="span"
					class="mr-1 mb-1 inline-block h-7 w-20 rounded-full border border-link p-1 dark:border-white/10"
				/>
			</span>

			<Skeleton as="span" class="mx-auto block h-12 w-40 rounded md:mx-0 md:h-5" />
		</div>
	</div>

	<div>
		<Icon type="fa" icon="comment" w="16" h="16" class="animate-pulse text-link/50" />
	</div>
</div>
