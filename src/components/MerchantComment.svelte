<script lang="ts">
	import Time from 'svelte-time';
	import type { MerchantPageData } from '$lib/types';

	export let text: MerchantPageData['comments'][number]['text'];
	export let time: MerchantPageData['comments'][number]['created_at'];
</script>

<div
	class="items-center space-y-2 p-5 text-center text-xl lg:flex lg:space-y-0 lg:space-x-5 lg:text-left"
>
	<div class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0">
		<div class="space-y-2 lg:space-y-0">
			<span class="text-primary lg:mr-5 dark:text-white">
				{text}
			</span>

			<span class="block text-center font-semibold text-taggerTime lg:inline dark:text-gray-400">
				<Time timestamp={time} />
			</span>
		</div>
	</div>
</div>
