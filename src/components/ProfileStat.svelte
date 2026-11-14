<script lang="ts">
import {
	Tooltip,
	TooltipArrow,
	TooltipContent,
	TooltipTrigger,
} from "@ui-sdk/svelte/tooltip";

import Icon from "$components/Icon.svelte";
import Skeleton from "$components/Skeleton.svelte";

type Props = {
	title: string;
	stat: number | undefined;
	percent?: string;
	border?: string;
	tooltip?: string;
};

let { title, stat, percent, border, tooltip }: Props = $props();

// Rendered into <body>, where tippy put it: in place, the tooltip's <div>
// would sit inside the <h3> and join the heading's name while open
const tooltipContainer =
	typeof document === "undefined" ? undefined : document.body;
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="text-center text-lg font-semibold text-primary md:text-left dark:text-white">
		{title}
		{#if tooltip}
			<!-- toggleable: a tap opens it too, touch screens have no hover -->
			<Tooltip toggleable delay={0} container={tooltipContainer}>
				<TooltipTrigger>
					<Icon type="fa" icon="circle-info" w="16" h="16" class="text-base" aria-hidden="true" />
				</TooltipTrigger>
				<!-- tippy.js's default theme: #333 box, 10px gap, 300ms fade -->
				<TooltipContent
					sideOffset={10}
					class="w-max max-w-[350px] rounded bg-[#333] px-[9px] py-[5px] text-sm leading-[1.4] text-white transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
				>
					<TooltipArrow
						class="size-[11px] rotate-45 bg-[#333] data-[side=bottom]:-top-[5.5px] data-[side=left]:-right-[5.5px] data-[side=right]:-left-[5.5px] data-[side=top]:-bottom-[5.5px]"
					/>
					{tooltip}
				</TooltipContent>
			</Tooltip>
		{/if}
	</h3>

	<div class="flex justify-center md:justify-start">
		{#if stat !== undefined}
			<span class="text-5xl font-semibold text-primary dark:text-white">{stat}</span>
			{#if percent}
				<span class="ml-1 text-lg text-body dark:text-white">({percent}%)</span>
			{/if}
		{:else}
			<!-- loading skeleton -->
			<Skeleton as="span" class="h-[48px] w-[150px] rounded-xl" />
		{/if}
	</div>
</div>
