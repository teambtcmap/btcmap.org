<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { showTags, taggingIssues } from "$lib/store";
import type { Issue, OSMTags } from "$lib/types";

// Collapsed disclosure for the power-user / tagger actions that shouldn't
// compete with the traveller-facing chips.
export let osmTags: OSMTags;
export let issues: Issue[] = [];
export let osmViewUrl: string | undefined = undefined;

let open = false;

const chip =
	"inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-link hover:text-link dark:border-white/20 dark:text-white dark:hover:border-link dark:hover:text-link";
</script>

<div class="border-t border-gray-300 pt-3 dark:border-white/20">
	<button
		type="button"
		on:click={() => (open = !open)}
		aria-expanded={open}
		class="flex w-full items-center justify-between text-xs font-semibold tracking-wide text-body uppercase dark:text-white/60"
	>
		<span>{$_('merchant.taggerTools')}</span>
		<Icon w="16" h="16" icon="expand_more" type="material" class={open ? 'rotate-180' : ''} />
	</button>

	{#if open}
		<div class="mt-3 flex flex-wrap gap-2">
			<button type="button" class={chip} on:click={() => ($showTags = osmTags)}>
				<Icon w="16" h="16" icon="sell" type="material" />
				{$_('merchant.showTags')}
			</button>

			{#if issues.length}
				<button type="button" class={chip} on:click={() => ($taggingIssues = issues)}>
					<Icon w="16" h="16" icon="warning" type="material" />
					{$_('merchant.tagIssues')}
				</button>
			{/if}

			{#if osmViewUrl}
				<a href={osmViewUrl} target="_blank" rel="noopener noreferrer" class={chip}>
					<Icon w="16" h="16" icon="open_in_new" type="material" />
					{$_('merchant.viewOSM')}
				</a>
			{/if}
		</div>

		<p class="mt-3 text-xs text-body dark:text-white/60">
			{$_('merchant.tagsNote')}
			<a
				href="https://wiki.btcmap.org/Tagging-Merchants#tagging-guidance"
				target="_blank"
				rel="noreferrer"
				class="text-link transition-colors hover:text-hover">{$_('merchant.tagsNoteHere')}</a
			>.
		</p>
	{/if}
</div>
