<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { ISSUE_PIN_VARIANTS, PIN_FILLS } from "$lib/map/maplibreSprites";
import { derivePlaceIssues } from "$lib/placeIssues";
import type { Place } from "$lib/types";

import { resolve } from "$app/paths";

// Collapsed disclosure for a place's derived issues (?issues worklist,
// #921): one quiet line until tapped, then plain-language explanations —
// dots match the pin colors — and the two fix actions. Same pattern as the
// merchant page's TaggerTools so the drawer stays lean.
type Props = {
	merchant: Place;
	osmEditUrl: string;
	isLoading?: boolean;
};

let { merchant, osmEditUrl, isLoading = false }: Props = $props();

let open = $state(false);

const codes = $derived(derivePlaceIssues(merchant));

const chip =
	"inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-link hover:text-link dark:border-white/20 dark:text-white dark:hover:border-link dark:hover:text-link";
</script>

{#if !isLoading && codes.length}
	<div class="border-t border-gray-300 py-2.5 dark:border-white/20">
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			class="flex w-full items-center justify-between text-sm text-body dark:text-white"
		>
			<span class="flex items-center gap-2">
				<Icon
					w="16"
					h="16"
					icon="warning"
					type="material"
					class="shrink-0 text-amber-600 dark:text-amber-400"
				/>
				{$_('issuesMode.row.title')} ({codes.length})
			</span>
			<Icon
				w="16"
				h="16"
				icon="expand_more"
				type="material"
				class={open ? 'rotate-180' : ''}
			/>
		</button>

		{#if open}
			<ul class="mt-2 space-y-1.5">
				{#each codes as code (code)}
					<li class="flex items-center gap-2 text-sm text-body dark:text-white/80">
						<span
							class="h-2 w-2 shrink-0 rounded-full"
							style="background-color: {PIN_FILLS[ISSUE_PIN_VARIANTS[code]]}"
						></span>
						{$_(`issuesMode.issues.${code}`)}
					</li>
				{/each}
			</ul>

			<div class="mt-3 flex flex-wrap gap-2">
				<a href={`${resolve('/verify-location')}?id=${merchant.id}`} class={chip}>
					<Icon w="16" h="16" icon="verified" type="material" />
					{$_('verification.verifyLocation')}
				</a>
				<a
					href={osmEditUrl}
					target="_blank"
					rel="noopener noreferrer"
					class={chip}
				>
					<Icon w="16" h="16" icon="open_in_new" type="material" />
					{$_('issuesMode.row.editOsm')}
				</a>
			</div>
		{/if}
	</div>
{/if}
