<script lang="ts">
import Time from "svelte-time";

import { commentDomId } from "$lib/commentPermalink";
import type { MerchantPageData } from "$lib/types";

type Props = {
	commentId: MerchantPageData["comments"][number]["id"];
	text: MerchantPageData["comments"][number]["text"];
	time: MerchantPageData["comments"][number]["created_at"];
	compact?: boolean;
	// Driven by the page from the current #comment-<id> hash. CSS :target
	// can't do this: on a fresh load the comment renders after the i18n
	// gate, long after the browser gave up finding the fragment target.
	highlighted?: boolean;
};

let {
	commentId,
	text,
	time,
	compact = false,
	highlighted = false,
}: Props = $props();
</script>

<div
	id={commentDomId(commentId)}
	class="scroll-mt-24 transition-colors {highlighted
		? 'bg-link/10 dark:bg-link/15'
		: ''}"
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
				<a href="#{commentDomId(commentId)}" class="hover:underline">
					<Time timestamp={time} />
				</a>
			</span>
		</div>
	</div>
</div>
