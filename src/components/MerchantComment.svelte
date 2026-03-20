<script lang="ts">
import Time from "svelte-time";

export let text: string;
export let time: string;
export let compact = false;
</script>

{#if compact}
	<div class="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
		<p class="text-sm text-primary dark:text-white">{text}</p>
		<span class="mt-1 block text-xs text-body dark:text-white/50">
			<Time timestamp={time} relative live={60000} />
		</span>
	</div>
{:else}
	<div
		class="items-center space-y-2 p-5 text-center text-xl lg:flex lg:space-y-0 lg:space-x-5 lg:text-left"
	>
		<div
			class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0"
		>
			<div class="space-y-2 lg:space-y-0">
				<span class="text-primary dark:text-white lg:mr-5">
					{text}
				</span>

				<span
					class="block text-center font-semibold text-taggerTime dark:text-white/70 lg:inline"
				>
					<Time timestamp={time} />
				</span>
			</div>
		</div>
	</div>
{/if}
