<script lang="ts">
import { onMount } from "svelte";

import { _ } from "#lib/i18n/index.js";
import { theme } from "#lib/theme.js";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";

type Props = {
	type: string;
	text: string;
	issue?: number;
	buttonWidth?: string;
	repo?: "btcmap-data" | "btcmap-infra";
	showIssueLink?: boolean;
	onclick?: (event: MouseEvent) => void;
};
let {
	type,
	text,
	issue,
	buttonWidth = "w-52",
	repo = "btcmap-data",
	showIssueLink = true,
	onclick,
}: Props = $props();

// The form this replaces held focus; without a new target it falls to
// <body> and the success goes unannounced (#1548).
let heading = $state<HTMLHeadingElement>();
onMount(() => heading?.focus());
</script>

<div class="mt-10 flex items-center justify-center pb-20 text-center md:pb-32">
	<div>
		{#if typeof window !== 'undefined'}
			<h2
				bind:this={heading}
				tabindex="-1"
				class="{$theme === 'dark' ? 'text-white' : 'gradient'} mb-5 text-4xl font-semibold focus:outline-none"
			>
				{$_("formSuccess.submittedTitle", { values: { type } })}
			</h2>
		{:else}
			<HeaderPlaceholder />
		{/if}
		<p class="mb-5 w-full text-primary md:w-[500px] dark:text-white">
			{text}
			{#if showIssueLink && issue}
				{$_("formSuccess.monitorProgress")}
				<a
					href="https://gitea.btcmap.org/teambtcmap/{repo}/issues/{issue}"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">{$_("formSuccess.issueLink", { values: { issue } })}</a
				>.
			{/if}
		</p>

		<PrimaryButton {onclick} style="{buttonWidth} py-3 mx-auto mt-10 rounded-xl">
			{$_("formSuccess.submitAnother", { values: { type } })}
		</PrimaryButton>
	</div>
</div>
