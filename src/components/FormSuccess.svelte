<script lang="ts">
export let type: string;
export let text: string;
export let issue: number | undefined = undefined;
export let buttonWidth = "w-52";
export let repo: "btcmap-data" | "btcmap-infra" = "btcmap-data";
export let showIssueLink = true;

import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";
</script>

<div class="mt-10 flex items-center justify-center pb-20 text-center md:pb-32">
	<div>
		{#if typeof window !== 'undefined'}
			<h2 class="{$theme === 'dark' ? 'text-white' : 'gradient'} mb-5 text-4xl font-semibold">
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

		<PrimaryButton on:click style="{buttonWidth} py-3 mx-auto mt-10 rounded-xl">
			{$_("formSuccess.submitAnother", { values: { type } })}
		</PrimaryButton>
	</div>
</div>
