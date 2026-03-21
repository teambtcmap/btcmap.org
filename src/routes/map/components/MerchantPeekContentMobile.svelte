<script lang="ts">
import BoostBadge from "$components/BoostBadge.svelte";
import Icon from "$components/Icon.svelte";
import PaymentMethodPill from "$components/PaymentMethodPill.svelte";
import { _ } from "$lib/i18n";
import type { Place } from "$lib/types";

export let merchant: Place;
export let isUpToDate: boolean;
export let isBoosted: boolean;
export let isLoading: boolean = false;

$: hasName = merchant.name !== undefined;
$: hasAcceptedPayment =
	merchant["osm:payment:lightning"] === "yes" ||
	merchant["osm:payment:onchain"] === "yes" ||
	merchant["osm:payment:lightning_contactless"] === "yes";
$: hasVerification = merchant.verified_at !== undefined;
</script>

<div class="space-y-3">
	<!-- Name and status row -->
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			{#if hasName}
				<h3 class="truncate text-lg leading-tight font-bold text-primary dark:text-white">
					{merchant.name}
				</h3>
			{:else if isLoading}
				<div class="h-6 w-3/4 animate-pulse rounded bg-link/50"></div>
			{/if}
		</div>

		{#if isBoosted}
			<BoostBadge />
		{/if}
	</div>

	<!-- Payment methods and verification -->
	<div class="flex items-center justify-between gap-4">
		<!-- Payment methods -->
		<div class="flex flex-wrap items-center gap-1.5">
			{#if hasAcceptedPayment}
				{#if merchant['osm:payment:lightning'] === 'yes'}
					<PaymentMethodPill method="ln" label={$_('payment.lightning')} />
				{/if}
				{#if merchant['osm:payment:onchain'] === 'yes'}
					<PaymentMethodPill method="btc" label={$_('payment.onchain')} />
				{/if}
				{#if merchant['osm:payment:lightning_contactless'] === 'yes'}
					<PaymentMethodPill method="nfc" label={$_('payment.lightningContactless')} />
				{/if}
			{:else if isLoading}
				<div class="flex gap-1.5">
					<div class="h-6 w-16 animate-pulse rounded-full bg-link/50"></div>
					<div class="h-6 w-16 animate-pulse rounded-full bg-link/50"></div>
				</div>
			{/if}
		</div>

		<!-- Verification status -->
		<div class="flex items-center gap-2 text-xs">
			{#if hasVerification}
				{#if isUpToDate}
					<div class="flex items-center gap-1 text-green-600 dark:text-green-400">
						<Icon w="14" h="14" icon="verified" type="material" />
						<span>{$_('verification.verified')}</span>
					</div>
				{:else}
					<div class="flex items-center gap-1 text-orange-600 dark:text-orange-400">
						<Icon w="14" h="14" icon="warning" type="material" />
						<span>{$_('verification.outdated')}</span>
					</div>
				{/if}
			{:else if isLoading}
				<div class="h-4 w-16 animate-pulse rounded bg-link/50"></div>
			{/if}
		</div>
	</div>

	<!-- Swipe hint -->
	<div class="flex items-center justify-end border-t border-gray-200 pt-3 dark:border-white/10">
		<div class="flex items-center gap-1 text-xs text-body dark:text-white/50">
			<Icon w="14" h="14" icon="arrow_upward" type="material" />
			<span>{$_('mapDrawer.swipeUpForDetails')}</span>
			<span class="mx-1">·</span>
			<Icon w="14" h="14" icon="arrow_downward" type="material" />
			<span>{$_('mapDrawer.swipeDownToClose')}</span>
		</div>
	</div>
</div>
