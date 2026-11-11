<script lang="ts">
import { trackEvent } from "#lib/analytics.js";
import { _, locale } from "#lib/i18n/index.js";
import type { MerchantPageData } from "#lib/types.js";
import { formatVerifiedHuman } from "#lib/utils.js";
import { isRecentlyVerified } from "#lib/verification.js";
import { verifyLocationHref } from "#lib/verifyLocation.js";
import Icon from "$components/Icon.svelte";

// Survey-date + inline "Verify Location" link, matching the map drawer
// (MerchantDetailsContent). Neutral styling — the verify link is always
// present so a user can verify in any state.
type Props = {
	id: MerchantPageData["id"];
	verifiedAt?: string | null;
};

let { id, verifiedAt }: Props = $props();

const upToDate = $derived(isRecentlyVerified(verifiedAt));
const href = $derived(verifyLocationHref(id));
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
		<span class="text-sm text-body dark:text-white">{formatVerifiedHuman(verifiedAt, $locale)}</span>
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
		onclick={() => trackEvent('verify_location_click', { source: 'merchant_page' })}
		class="text-sm font-semibold text-link transition-colors hover:text-hover"
		title={$_('verification.helpImprove')}
	>
		{$_('verification.verifyLocation')}
	</a>
</div>
