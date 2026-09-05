<script lang="ts">
import { tick } from "svelte";

import BoostContent from "$components/BoostContent.svelte";
import CloseButton from "$components/CloseButton.svelte";
import Icon from "$components/Icon.svelte";
import MerchantDetailsContent from "$components/MerchantDetailsContent.svelte";
import {
	MAP_PANEL_MARGIN,
	MERCHANT_LIST_WIDTH,
	PANEL_DRAWER_GAP,
} from "$lib/constants";
import { _ } from "$lib/i18n";
import {
	handleBoost as boostMerchant,
	isBoosted as checkBoosted,
	clearBoostState,
	handleBoostComplete as completeBoost,
	ensureBoostData,
} from "$lib/merchantDrawerLogic";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import { merchantList } from "$lib/merchantListStore";
import { boost, resetBoost } from "$lib/store";
import { isUpToDate as checkUpToDate } from "$lib/verification";

import MapPanelShell from "./MapPanelShell.svelte";
import { invalidateAll } from "$app/navigation";

// ?issues worklist (#921): show the merchant's derived-issue row.
type Props = { showIssues?: boolean };
let { showIssues = false }: Props = $props();

// Derive state from the centralized store
const isOpen = $derived($merchantDrawer.isOpen);
const merchantId = $derived($merchantDrawer.merchantId);
const drawerView = $derived($merchantDrawer.drawerView);
const merchant = $derived($merchantDrawer.merchant);
const fetchingMerchant = $derived($merchantDrawer.isLoading);
const listIsOpen = $derived($merchantList.isOpen);

// Calculate drawer position based on list panel state
const drawerLeft = $derived(
	listIsOpen
		? MAP_PANEL_MARGIN + MERCHANT_LIST_WIDTH + PANEL_DRAWER_GAP
		: MAP_PANEL_MARGIN,
);

// Focus management - move focus to drawer when it opens
let drawerElement = $state<HTMLElement>();
$effect(() => {
	if (isOpen && drawerElement) {
		const el = drawerElement;
		tick().then(() => {
			const closeBtn = el.querySelector("button");
			closeBtn?.focus();
		});
	}
});

const isUpToDate = $derived(checkUpToDate(merchant));
const isBoosted = $derived(checkBoosted(merchant));

let boostLoading = $state(false);
const setBoostLoading = (loading: boolean) => {
	boostLoading = loading;
};

const closeDrawer = () => {
	clearBoostState();
	boostLoading = false;
	merchantDrawer.close();
};

const goBack = () => {
	clearBoostState();
	boostLoading = false;
	merchantDrawer.setView("details");
};

$effect(() => {
	if (drawerView !== "boost" && $boost !== undefined) {
		clearBoostState();
		boostLoading = false;
	}
});

const handleBoost = () => boostMerchant(merchant, merchantId, setBoostLoading);
const handleBoostComplete = () =>
	completeBoost(merchantId, invalidateAll, resetBoost);

function handleKeydown(event: KeyboardEvent) {
	if (!isOpen) return;

	if (event.key === "Escape") {
		event.preventDefault();
		if (drawerView !== "details") {
			goBack();
		} else {
			closeDrawer();
		}
	}
}

$effect(() => {
	if (drawerView === "boost" && merchant) {
		ensureBoostData(merchant, $boost);
	}
});

export function openDrawer(id: number) {
	merchantDrawer.open(id, "details");
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Floating drawer card - no backdrop, keep map interactive -->
	<!-- Position offset by MERCHANT_LIST_WIDTH when list panel is open;
	     this variant only mounts ≥md, so the shell's mobile face never
	     shows here. -->
	<MapPanelShell
		bind:element={drawerElement}
		label={$_("mapDrawer.merchantDetails")}
		role="dialog"
		left={drawerLeft}
		headerBorder={drawerView !== "details"}
	>
		{#snippet header()}
			{#if drawerView !== 'details'}
				<!-- Back button for nested views -->
				<button
					onclick={goBack}
					class="flex items-center space-x-2 text-primary transition-colors hover:text-link dark:text-white dark:hover:text-link"
				>
					<Icon w="20" h="20" icon="arrow_back" type="material" />
					<span class="text-sm font-semibold">{$_("mapDrawer.back")}</span>
				</button>
				<span class="text-sm font-semibold text-primary capitalize dark:text-white"
					>{drawerView === 'boost' ? $_("mapDrawer.viewBoost") : $_("mapDrawer.viewDetails")}</span
				>
			{:else}
				<!-- Spacer to keep close button aligned -->
				<div></div>
			{/if}
			<CloseButton on:click={closeDrawer} ariaLabel={$_("mapDrawer.closeMerchantDetails")} />
		{/snippet}

		{#if !merchant && fetchingMerchant}
			<!-- Loading skeleton -->
			<div class="space-y-4 px-6 pt-3 pb-6">
				<!-- Title skeleton -->
				<div class="h-7 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
				<!-- Address skeleton -->
				<div class="h-5 w-1/2 animate-pulse rounded bg-link/50"></div>
				<!-- Payment methods skeleton -->
				<div class="flex space-x-2">
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
				</div>
				<!-- Stats grid skeleton -->
				<div class="grid grid-cols-2 gap-2">
					<div class="h-20 animate-pulse rounded-lg bg-link/50"></div>
					<div class="h-20 animate-pulse rounded-lg bg-link/50"></div>
				</div>
				<!-- Large content skeleton -->
				<div class="h-32 animate-pulse rounded-lg bg-link/50"></div>
			</div>
		{:else if merchant}
			<div class="px-6 pt-3 pb-6">
				{#if drawerView === 'boost'}
					<BoostContent merchantId={merchant.id} onComplete={handleBoostComplete} />
				{:else}
					<MerchantDetailsContent
						{merchant}
						{isUpToDate}
						{isBoosted}
						{boostLoading}
						{showIssues}
						onBoostClick={handleBoost}
						isLoading={fetchingMerchant}
					/>
				{/if}
			</div>
		{/if}
	</MapPanelShell>
{/if}
