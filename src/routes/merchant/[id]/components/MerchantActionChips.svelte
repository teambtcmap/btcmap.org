<script lang="ts">
import { onDestroy } from "svelte";

import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { shareMerchant } from "$lib/utils";

// Primary traveller actions, rendered as an equal-width chip row. Secondary
// actions (socials, pay) and tagger tools live in the Details tab instead.
export let merchantId: string | number;
export let lat: number;
export let long: number;
export let phone: string | undefined = undefined;
export let osmEditUrl: string | undefined = undefined;

let shareConfirm = false;
let shareTimeout: ReturnType<typeof setTimeout>;

const share = () => {
	shareMerchant(merchantId);
	clearTimeout(shareTimeout);
	shareConfirm = true;
	shareTimeout = setTimeout(() => (shareConfirm = false), 2000);
};

onDestroy(() => clearTimeout(shareTimeout));

const chip =
	"flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-link/60 px-2 py-2.5 text-link transition-colors hover:bg-link/10 dark:border-white/40 dark:text-white dark:hover:bg-white/10";
</script>

<div class="flex gap-2">
	<a href={`geo:${lat},${long}`} class={chip}>
		<Icon w="22" h="22" icon="explore" type="material" />
		<span class="text-xs font-semibold">{$_('merchant.navigate')}</span>
	</a>

	{#if phone}
		<a href={`tel:${phone}`} class={chip}>
			<Icon w="22" h="22" icon="phone" type="material" />
			<span class="text-xs font-semibold">{$_('merchant.call')}</span>
		</a>
	{/if}

	<button type="button" on:click={share} class={chip}>
		<Icon w="22" h="22" icon={shareConfirm ? 'check_circle' : 'share'} type="material" />
		<span class="text-xs font-semibold">{$_('merchant.share')}</span>
	</button>

	{#if osmEditUrl}
		<a href={osmEditUrl} target="_blank" rel="noopener noreferrer" class={chip}>
			<Icon w="22" h="22" icon="edit" type="material" />
			<span class="text-xs font-semibold">{$_('merchant.edit')}</span>
		</a>
	{/if}
</div>
