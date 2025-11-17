<script lang="ts">
	import Icon from '$components/Icon.svelte';
	import type { Place } from '$lib/types';
	import PaymentMethodIcon from './PaymentMethodIcon.svelte';

	export let merchant: Place;
	export let isUpToDate: boolean;
	export let isBoosted: boolean;
</script>

<div class="space-y-3">
	<!-- Name and status row -->
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			{#if merchant.name}
				<h3 class="truncate text-lg leading-tight font-bold text-primary dark:text-white">
					{merchant.name}
				</h3>
			{/if}
		</div>

		<!-- Boost badge if boosted -->
		{#if isBoosted}
			<div
				class="flex-shrink-0 rounded-full bg-link px-2.5 py-1 text-xs font-semibold text-white"
				title="Boosted merchant"
			>
				<Icon w="14" h="14" icon="zap" type="popup" style="inline mr-1" />
				Boosted
			</div>
		{/if}
	</div>

	<!-- Payment methods and verification -->
	<div class="flex items-center justify-between gap-4">
		<!-- Payment methods -->
		<div class="flex items-center space-x-2">
			{#if merchant['osm:payment:onchain']}
				<PaymentMethodIcon status={merchant['osm:payment:onchain']} method="btc" label="On-chain" />
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
		</div>

		<!-- Verification status -->
		<div class="flex items-center gap-2 text-xs">
			{#if isUpToDate}
				<div class="flex items-center gap-1 text-green-600 dark:text-green-400">
					<Icon w="14" h="14" icon="check" type="popup" />
					<span>Verified</span>
				</div>
			{:else}
				<div class="flex items-center gap-1 text-orange-600 dark:text-orange-400">
					<Icon w="14" h="14" icon="alert" type="popup" />
					<span>Outdated</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Tap hint -->
	<div class="flex items-center justify-end border-t border-gray-200 pt-3 dark:border-white/10">
		<!-- Tap/swipe hint -->
		<div class="flex items-center gap-1 text-xs text-body dark:text-white/50">
			<Icon w="14" h="14" icon="arrow_upward" type="material" />
			<span>Swipe up for details</span>
		</div>
	</div>
</div>
