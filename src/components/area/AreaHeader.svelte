<script lang="ts">
import { _ } from "svelte-i18n";

import Icon from "$components/Icon.svelte";
import OrgBadge from "$components/OrgBadge.svelte";
import SaveButton from "$components/SaveButton.svelte";
import Socials from "$components/Socials.svelte";
import SponsorBadge from "$components/SponsorBadge.svelte";
import Tip from "$components/Tip.svelte";
import type { AreaPageProps } from "$lib/types.js";
import { TipType } from "$lib/types.js";
import { areaIconSrc, formatVerifiedHuman } from "$lib/utils";
import { isRecentlyVerified } from "$lib/verification";

export let type: "country" | "community";
export let data: AreaPageProps;

// Everything below DERIVES from the SSR bundle — no imperative init, no
// reset lifecycle: an area navigation swaps `data` and every value follows.
$: area = data.tags;
$: alias = data.id;
let name: string;
$: name = data.name;
$: avatar =
	type === "community"
		? areaIconSrc(data.id, area["icon:square"])
		: `https://static.btcmap.org/images/countries/${data.id}.svg`;
$: description = area.description;
$: org = area.organization;
$: sponsor = area.sponsor;
$: hasContact = Object.keys(data.contacts).length > 0;
$: verifiedDate = data.verifiedDate || area["verified:date"];
$: isVerifiedDateStale = !isRecentlyVerified(verifiedDate);
$: lightning = area["tips:lightning_address"]
	? { destination: area["tips:lightning_address"], type: TipType.Address }
	: area["tips:url"]
		? { destination: area["tips:url"], type: TipType.Url }
		: undefined;
</script>

<section id="profile" class="space-y-8">
	<div class="space-y-2">
		<img
			src={avatar}
			alt={$_('aria.avatarAlt')}
			class="mx-auto h-32 w-32 rounded-full object-cover"
			on:error={function () {
				this.src = '/images/bitcoin.svg';
			}}
		/>
		<h1 class="text-4xl !leading-tight font-semibold text-primary dark:text-white">
			{name || $_('area.defaultName')}
		</h1>
		<SaveButton id={data.numericId} type="area" />
		{#if org}
			<OrgBadge {org} />
		{/if}
		{#if sponsor}
			<SponsorBadge />
		{/if}
		{#if description}
			<p class="text-xl text-primary dark:text-white">{description}</p>
		{/if}
		{#if type === 'community'}
			<a
				href={`/communities/map?community=${encodeURIComponent(alias)}`}
				class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
				>{$_('area.viewOnCommunityMap')} <svg
					class="ml-1 w-3"
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M3 13L13 3M13 3H5.5M13 3V10.5"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg></a
			>
		{/if}
		{#if type === 'community'}
			{#if verifiedDate}
				<div class="flex items-center justify-center gap-2 text-sm font-semibold">
					{#if isVerifiedDateStale}
						<div
							class="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
						>
							<Icon type="fa" icon="circle-exclamation" w="14" h="14" />
							<span>{$_('area.verifiedOverYearAgo')}</span>
						</div>
					{:else}
						<div
							class="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300"
						>
							<Icon type="material" icon="verified" w="14" h="14" />
							<span>{$_('area.verified')}: {formatVerifiedHuman(verifiedDate)}</span>
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex items-center justify-center gap-2 text-sm font-semibold">
					<div
						class="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-300"
					>
						<Icon type="fa" icon="circle-xmark" w="14" h="14" />
						<span>{$_('area.notRecentlyVerified')}</span>
					</div>
				</div>
			{/if}
			<!-- Plain navigation on purpose: the maintain route's own load fetches
			     the per-section-pruned issues, and the hash scrolls to the form. An
			     in-place section switch would render maintain with an empty issues
			     table (#1210's pruning). -->
			<a
				href={`/community/${encodeURIComponent(alias)}/maintain#verify-form`}
				class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
				>{$_('area.verifyCommunity')}</a
			>
		{/if}
	</div>

	{#if type === 'community'}
		{#if hasContact}
			<Socials contacts={data.contacts} />
		{/if}

		{#if lightning}
			<Tip destination={lightning.destination} type={lightning.type} user={name} />
		{/if}
	{/if}
</section>
