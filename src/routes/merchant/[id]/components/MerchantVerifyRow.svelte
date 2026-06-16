<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { formatVerifiedHuman } from "$lib/utils";
import { isRecentlyVerified } from "$lib/verification";

import { resolve } from "$app/paths";

// Survey-date + inline "Verify Location" link, matching the map drawer
// (MerchantDetailsContent). Neutral styling — the verify link is always
// present so a user can verify in any state.
export let id: string | number;
export let verifiedAt: string | undefined | null = undefined;

$: upToDate = isRecentlyVerified(verifiedAt);
$: href = resolve(`/verify-location?id=${encodeURIComponent(String(id))}`);
</script>

<div class="flex items-center gap-2">
	{#if verifiedAt}
		<Icon
			w="16"
			h="16"
			class="shrink-0 text-primary dark:text-white"
			icon={upToDate ? 'verified' : 'error_outline'}
			type="material"
		/>
		<span class="text-sm text-body dark:text-white">{formatVerifiedHuman(verifiedAt)}</span>
	{:else}
		<Icon
			w="16"
			h="16"
			class="shrink-0 text-body dark:text-white/70"
			icon="error_outline"
			type="material"
		/>
		<span class="text-sm text-body dark:text-white">{$_('verification.notSurveyed')}</span>
	{/if}

	<span class="text-body dark:text-white/50">·</span>
	<a
		href={href}
		class="text-sm font-semibold text-link transition-colors hover:text-hover"
		title={$_('verification.helpImprove')}
	>
		{$_('verification.verifyLocation')}
	</a>
</div>
