<script lang="ts">
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import PaymentMethodIcon from "$components/PaymentMethodIcon.svelte";
import { _ } from "$lib/i18n";
import type { Place } from "$lib/types";
import { formatVerifiedHuman } from "$lib/utils";

import { resolve } from "$app/paths";

export let merchant: Place;
export let isUpToDate: boolean;
export let isBoosted: boolean;
export let boostLoading: boolean;
export let onBoostClick: () => void;
export let isLoading: boolean = false;
</script>

<div class="space-y-4">
	{#if merchant.deleted_at}
		<div class="rounded-lg bg-red-600 p-3 text-center text-sm text-white">
			<p class="font-semibold">
				<Icon w="16" h="16" class="mr-1 inline-block text-white" icon="skull" type="material" />
				{$_('merchant.deletedBanner')}
			</p>
		</div>
	{/if}

	{#if merchant.name}
		<a
			href={resolve(`/merchant/${merchant.id}`)}
			class="inline-block text-xl leading-snug font-bold text-link transition-colors hover:text-hover"
			title={$_('merchant.merchantName')}
		>
			{merchant.name}
		</a>
	{:else if isLoading}
		<div class="h-7 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
	{/if}

	{#if merchant.address}
		<p class="text-body dark:text-white" title={$_('merchant.address')}>
			{merchant.address}
		</p>
	{:else if isLoading}
		<div class="h-5 w-1/2 animate-pulse rounded bg-link/50"></div>
	{/if}

	{#if merchant.opening_hours}
		<div class="flex items-start space-x-2" title={$_('merchant.openingHours')}>
			<Icon
				w="16"
				h="16"
				class="mt-1 shrink-0 text-primary dark:text-white"
				icon="schedule"
				type="material"
			/>
			<span class="text-body dark:text-white">{merchant.opening_hours}</span>
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-2">
		<a
			href="geo:{merchant.lat},{merchant.lon}"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="explore" type="material" />
			<span class="mt-1 text-xs">{$_('merchant.navigate')}</span>
		</a>

		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<!-- External link to OpenStreetMap -->
		<a
			href={merchant.osm_url || `https://www.openstreetmap.org/node/${merchant.id}`}
			target="_blank"
			rel="noreferrer"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="edit" type="material" />
			<span class="mt-1 text-xs">{$_('merchant.edit')}</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		<a
			href={resolve(`/merchant/${merchant.id}`)}
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="share" type="material" />
			<span class="mt-1 text-xs">{$_('merchant.share')}</span>
		</a>

		<a
			href={resolve(`/merchant/${merchant.id}#comments`)}
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<div class="text-lg font-bold">
				{merchant.comments || 0}
			</div>
			<span class="mt-1 text-xs">{$_('merchant.comments')}</span>
		</a>
	</div>

	<div class="border-t border-gray-300 pt-4 dark:border-white/95">
		{#if merchant['osm:payment:onchain'] || merchant['osm:payment:lightning'] || merchant['osm:payment:lightning_contactless'] || merchant['osm:payment:bitcoin']}
			<div class="mb-4">
				<span class="block text-xs text-mapLabel dark:text-white/70">{$_('payment.methods')}</span>
				<div class="mt-1 flex space-x-2">
					<PaymentMethodIcon
						status={merchant['osm:payment:onchain']}
						method="btc"
						label={$_('payment.onchain')}
					/>
					<PaymentMethodIcon
						status={merchant['osm:payment:lightning']}
						method="ln"
						label={$_('payment.lightning')}
					/>
					<PaymentMethodIcon
						status={merchant['osm:payment:lightning_contactless']}
						method="nfc"
						label={$_('payment.lightningContactless')}
					/>
				</div>
			</div>
		{:else if isLoading}
			<div class="mb-4">
				<div class="h-3 w-24 animate-pulse rounded bg-link/50"></div>
				<div class="mt-1 flex space-x-2">
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
				</div>
			</div>
		{/if}

		<div class="mb-4">
			<span
				class="block text-xs text-mapLabel dark:text-white/70"
				title={$_('verification.surveyedBy')}>{$_('verification.lastSurveyed')}</span
			>
			{#if merchant.verified_at}
				<span class="block text-body dark:text-white">
					{#if isUpToDate}
						<Icon
							w="16"
							h="16"
							class="mr-1 inline text-primary dark:text-white"
							icon="verified"
							type="material"
						/>
					{:else}
						<Icon
							w="16"
							h="16"
							class="mr-1 inline text-primary dark:text-white"
							icon="error_outline"
							type="material"
						/>
					{/if}
					{formatVerifiedHuman(merchant.verified_at)}
				</span>
			{:else if isLoading}
				<div class="mt-1 h-5 w-32 animate-pulse rounded bg-link/50"></div>
			{:else}
				<span class="block text-body dark:text-white" title={$_('verification.outdatedTooltip')}
					>---</span
				>
			{/if}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={`${resolve('/verify-location')}?id=${merchant.id}`}
				class="text-xs text-link transition-colors hover:text-hover"
				title={$_('verification.helpImprove')}
			>
				{$_('verification.verifyLocation')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>

		<div>
			{#if isBoosted && merchant.boosted_until}
				<span class="block text-xs text-mapLabel dark:text-white/70" title={$_('boost.isBoosted')}
					>{$_('boost.expires')}</span
				>
				<span class="block text-body dark:text-white">
					<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
				</span>
			{/if}

			<button
				title={isBoosted ? $_('boost.extend') : $_('boost.title')}
				on:click={onBoostClick}
				disabled={boostLoading}
				class="mt-2 flex h-[32px] items-center justify-center space-x-2 rounded-lg border border-gray-300 px-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
			>
				{#if !boostLoading}
					<Icon w="16" h="16" icon="arrow_circle_up" type="material" />
				{/if}
				<span class="text-xs"
					>{boostLoading
						? $_('boost.boosting')
						: isBoosted
							? $_('boost.extend')
							: $_('boost.boostAction')}</span
				>
			</button>
		</div>
	</div>

	<a
		href={resolve(`/merchant/${merchant.id}`)}
		class="mt-4 block rounded-lg bg-link py-3 text-center text-white transition-colors hover:bg-hover"
	>
		{$_('merchant.viewDetails')}
	</a>
</div>
