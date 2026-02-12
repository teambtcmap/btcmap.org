<script lang="ts">
import Icon from "$components/Icon.svelte";
</script>

<div
	class="border-t-statBorder w-full items-center justify-between space-y-1 border-t p-5 text-center md:flex md:space-y-0 md:text-left"
>
	<div class="items-center space-y-1 md:flex md:space-y-0 md:space-x-2">
		<Icon type="fa" icon="ticket" w="20" h="20" class="animate-pulse text-xl text-link/50" />

		<div>
			<span class="mr-1 inline-block h-6 w-32 animate-pulse rounded bg-link/50" />

			<span class="block items-center md:inline-flex">
				<span
					class="mr-1 mb-1 inline-block h-7 w-20 animate-pulse rounded-full border border-link bg-link/25 p-1"
				/>
			</span>

			<span class="mx-auto block h-12 w-40 animate-pulse rounded bg-link/50 md:mx-0 md:h-5" />
		</div>
	</div>

	<div>
		<Icon type="fa" icon="comment" w="16" h="16" class="animate-pulse text-link/50" />
	</div>
</div>
