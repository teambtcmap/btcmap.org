<script lang="ts">
import Icon from "$components/Icon.svelte";
import PaymentMethodIcon from "$components/PaymentMethodIcon.svelte";
import type { Place } from "$lib/types";

export let merchant: Place;
export let isUpToDate: boolean;
export let isBoosted: boolean;
export let isLoading: boolean = false;

// Check if we have the detailed data needed for display
$: hasName = merchant.name !== undefined;
$: hasPaymentMethods =
	merchant["osm:payment:onchain"] !== undefined ||
	merchant["osm:payment:lightning"] !== undefined ||
	merchant["osm:payment:lightning_contactless"] !== undefined;
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

		<!-- Boost badge if boosted -->
		{#if isBoosted}
			<div
				class="flex-shrink-0 rounded-full bg-link px-2.5 py-1 text-xs font-semibold text-white"
				title="Boosted merchant"
			>
				<Icon w="14" h="14" icon="bolt" type="material" class="mr-1 inline" />
				Boosted
			</div>
		{/if}
	</div>

	<!-- Payment methods and verification -->
	<div class="flex items-center justify-between gap-4">
		<!-- Payment methods -->
		<div class="flex items-center space-x-2">
			{#if hasPaymentMethods}
				{#if merchant['osm:payment:onchain']}
					<PaymentMethodIcon
						status={merchant['osm:payment:onchain']}
						method="btc"
						label="On-chain"
					/>
				{/if}
				{#if merchant['osm:payment:lightning']}
					<PaymentMethodIcon
						status={merchant['osm:payment:lightning']}
						method="ln"
						label="Lightning"
					/>
				{/if}
				{#if merchant['osm:payment:lightning_contactless']}
					<PaymentMethodIcon
						status={merchant['osm:payment:lightning_contactless']}
						method="nfc"
						label="Lightning contactless"
					/>
				{/if}
			{:else if isLoading}
				<div class="flex space-x-2">
					<div class="h-6 w-6 animate-pulse rounded bg-link/50"></div>
					<div class="h-6 w-6 animate-pulse rounded bg-link/50"></div>
				</div>
			{/if}
		</div>

		<!-- Verification status -->
		<div class="flex items-center gap-2 text-xs">
			{#if hasVerification}
				{#if isUpToDate}
					<div class="flex items-center gap-1 text-green-600 dark:text-green-400">
						<Icon w="14" h="14" icon="verified" type="material" />
						<span>Verified</span>
					</div>
				{:else}
					<div class="flex items-center gap-1 text-orange-600 dark:text-orange-400">
						<Icon w="14" h="14" icon="warning" type="material" />
						<span>Outdated</span>
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
			<span>Swipe up for details</span>
			<span class="mx-1">·</span>
			<Icon w="14" h="14" icon="arrow_downward" type="material" />
			<span>Swipe down to close</span>
		</div>
	</div>
</div>
