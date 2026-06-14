<script lang="ts">
import Time from "svelte-time";

import type { MerchantPageData } from "$lib/types";

export let text: MerchantPageData["comments"][number]["text"];
export let time: MerchantPageData["comments"][number]["created_at"];
export let compact = false;
</script>

<div
	class:items-center={!compact}
	class:items-start={compact}
	class:space-y-2={!compact}
	class:space-y-1={compact}
	class:p-5={!compact}
	class:py-3={compact}
	class:text-center={!compact}
	class:text-left={compact}
	class:text-xl={!compact}
	class:text-base={compact}
	class:lg:flex={!compact}
	class:lg:space-y-0={!compact}
	class:lg:space-x-5={!compact}
	class:lg:text-left={!compact}
>
	<div
		class="w-full flex-wrap"
		class:items-center={!compact}
		class:items-start={compact}
		class:justify-between={!compact}
		class:space-y-2={!compact}
		class:lg:flex={!compact}
		class:lg:space-y-0={!compact}
	>
		<div class:space-y-2={!compact} class:space-y-1={compact} class:lg:space-y-0={!compact}>
			<span
				class="whitespace-pre-line text-primary dark:text-white"
				class:lg:mr-5={!compact}
			>
				{text}
			</span>

			<span
				class="block font-semibold text-taggerTime dark:text-white/70"
				class:text-center={!compact}
				class:lg:inline={!compact}
			>
				<Time timestamp={time} />
			</span>
		</div>
	</div>
</div>
