<script lang="ts">
import Icon from "$components/Icon.svelte";
import PaymentMethodIcon from "$components/PaymentMethodIcon.svelte";
import { _ } from "$lib/i18n";
import {
	isBoosted as checkBoosted,
	isUpToDate as checkUpToDate,
} from "$lib/merchantDrawerLogic";
import type { Place } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import {
	calculateDistance,
	formatDistance,
	formatVerifiedHuman,
} from "$lib/utils";

export let merchant: Place;
export let enrichedData: Place | null = null;
export let isSelected: boolean = false;
export let verifiedDate: number;
export let onclick: (merchant: Place) => void = () => {};
export let onmouseenter: (merchant: Place) => void = () => {};
export let onmouseleave: (merchant: Place) => void = () => {};

$: showSkeleton = !enrichedData;
$: displayData = enrichedData || merchant;
$: hasPaymentMethods =
	enrichedData?.["osm:payment:onchain"] !== undefined ||
	enrichedData?.["osm:payment:lightning"] !== undefined ||
	enrichedData?.["osm:payment:lightning_contactless"] !== undefined;

$: isVerified = checkUpToDate(displayData, verifiedDate);
$: isBoosted = checkBoosted(merchant);

$: userLoc = $userLocation.location;
$: usesMetric = $userLocation.usesMetricSystem;
$: distanceKm =
	userLoc && displayData?.lat && displayData?.lon
		? calculateDistance(
				userLoc.lat,
				userLoc.lon,
				displayData.lat,
				displayData.lon,
			)
		: null;
$: distanceDisplay =
	distanceKm !== null && usesMetric !== null
		? formatDistance(distanceKm, usesMetric)
		: null;

function handleClick() {
	onclick(merchant);
}
</script>

<li class="list-none">
	<button
		on:click={handleClick}
		on:mouseenter={() => onmouseenter(merchant)}
		on:mouseleave={() => onmouseleave(merchant)}
		class="w-full px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5 {isSelected
			? 'bg-link/5 dark:bg-link/10'
			: ''}"
		aria-current={isSelected ? 'true' : undefined}
		aria-describedby={distanceDisplay ? `distance-${merchant.id}` : undefined}
	>
		<div class="flex items-start gap-3">
			<!-- Icon -->
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {isBoosted
					? 'bg-bitcoin/10 text-bitcoin'
					: 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'}"
			>
				<Icon w="22" h="22" icon={merchant.icon || 'currency_bitcoin'} type="material" />
			</div>

			<div class="min-w-0 flex-1">
				<!-- Name with badges and distance -->
				<div class="flex items-center justify-between gap-1">
					<div class="flex items-center gap-1 min-w-0">
						{#if enrichedData?.name}
							<span
								class="truncate text-sm font-medium {isBoosted
									? 'text-bitcoin'
									: 'text-primary dark:text-white'}"
							>
								{enrichedData.name}
							</span>
							{#if isVerified}
								<Icon w="12" h="12" icon="verified" type="material" class="shrink-0 text-link" />
							{/if}
							{#if isBoosted}
								<Icon
									w="12"
									h="12"
									icon="arrow_circle_up"
									type="material"
									class="shrink-0 text-bitcoin"
								/>
							{/if}
						{:else if showSkeleton}
							<div class="h-4 w-32 animate-pulse rounded bg-link/50"></div>
						{:else}
							<span class="truncate text-sm font-medium text-primary dark:text-white"
								>{$_('merchant.unknown')}</span
							>
						{/if}
					</div>
					{#if distanceDisplay}
						<span
							id="distance-{merchant.id}"
							class="shrink-0 text-xs text-gray-400 dark:text-white/40"
						>
							{distanceDisplay}
						</span>
					{/if}
				</div>

				<!-- Address -->
				{#if enrichedData?.address}
					<p class="mt-0.5 truncate text-xs text-body dark:text-white/70">
						{enrichedData.address}
					</p>
				{:else if showSkeleton}
					<div class="mt-0.5 h-3 w-24 animate-pulse rounded bg-link/50"></div>
				{/if}

				<!-- Payment methods -->
				{#if enrichedData && hasPaymentMethods}
					<div class="mt-1.5 flex gap-1">
						<PaymentMethodIcon
							status={enrichedData['osm:payment:onchain']}
							method="btc"
							label={$_('payment.onchain')}
							size="sm"
						/>
						<PaymentMethodIcon
							status={enrichedData['osm:payment:lightning']}
							method="ln"
							label={$_('payment.lightning')}
							size="sm"
						/>
						<PaymentMethodIcon
							status={enrichedData['osm:payment:lightning_contactless']}
							method="nfc"
							label={$_('payment.lightningContactless')}
							size="sm"
						/>
					</div>
				{:else if showSkeleton}
					<div class="mt-1.5 flex gap-1">
						<div class="h-5 w-5 animate-pulse rounded bg-link/50"></div>
						<div class="h-5 w-5 animate-pulse rounded bg-link/50"></div>
					</div>
				{/if}

				<!-- Status badges -->
				{#if enrichedData}
					<div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
						{#if isBoosted}
							<span
								class="flex items-center gap-1 rounded-full bg-bitcoin/10 px-2 py-0.5 text-bitcoin"
							>
								<Icon w="12" h="12" icon="arrow_circle_up" type="material" />
								{$_('boost.boosted')}
							</span>
						{/if}
						<span class="flex items-center gap-1 text-gray-500 dark:text-white/60">
							<Icon w="12" h="12" icon={isVerified ? 'verified' : 'warning'} type="material" />
							{isVerified ? $_('verification.verified') : $_('verification.outdated')}
							{#if enrichedData.verified_at}
								<span class="text-gray-400 dark:text-white/40"
									>· {formatVerifiedHuman(enrichedData.verified_at)}</span
								>
							{/if}
						</span>
					</div>
				{:else if showSkeleton}
					<div class="mt-1.5 h-4 w-20 animate-pulse rounded bg-link/50"></div>
				{/if}
			</div>

			<!-- Chevron -->
			<Icon
				w="16"
				h="16"
				icon="chevron_right"
				type="material"
				class="mt-0.5 shrink-0 text-gray-400 dark:text-white/40"
			/>
		</div>
	</button>
</li>
