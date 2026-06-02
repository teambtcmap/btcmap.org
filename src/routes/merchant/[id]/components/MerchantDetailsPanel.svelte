<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import type { MerchantPageData } from "$lib/types";
import { areaIconSrc, formatOpeningHours } from "$lib/utils";

import TaggerTools from "./TaggerTools.svelte";
import { resolve } from "$app/paths";

export let data: MerchantPageData;

$: payHref =
	data.payment?.type === "uri"
		? data.payment.url || "#"
		: data.payment?.type === "pouch"
			? `https://app.pouch.ph/${data.payment.username}`
			: data.payment?.type === "coinos"
				? `https://coinos.io/${data.payment.username}`
				: "#";

$: hasLinks = !!(
	data.website ||
	data.instagram ||
	data.facebook ||
	data.twitter ||
	data.email ||
	data.payment
);

const labelClass =
	"text-xs font-semibold uppercase tracking-wide text-body dark:text-white/60";
const chip =
	"inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-link hover:text-link dark:border-white/20 dark:text-white dark:hover:border-link dark:hover:text-link";

const withProtocol = (value: string, base: string): string =>
	value.startsWith("http") ? value : `${base}${value}`;
</script>

<div class="space-y-6 text-left">
	<!-- contact + hours -->
	<dl class="divide-y divide-gray-300 dark:divide-white/10">
		{#if data.phone}
			<div class="flex items-start justify-between gap-4 py-3">
				<dt class={labelClass}>{$_('info.contact')}</dt>
				<dd class="text-right text-sm text-primary dark:text-white">
					<a href={`tel:${data.phone}`} class="text-link hover:text-hover">{data.phone}</a>
				</dd>
			</div>
		{/if}

		{#if data.address}
			<div class="flex items-start justify-between gap-4 py-3">
				<dt class={labelClass}>{$_('merchant.address')}</dt>
				<dd class="text-right text-sm text-primary dark:text-white">{data.address}</dd>
			</div>
		{/if}

		{#if data.hours}
			<div class="flex items-start justify-between gap-4 py-3">
				<dt class={labelClass}>{$_('info.hours')}</dt>
				<dd class="flex flex-col items-end text-right text-sm text-primary dark:text-white">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html formatOpeningHours(data.hours)}
				</dd>
			</div>
		{/if}
	</dl>

	<!-- links / socials / pay -->
	{#if hasLinks}
		<div class="space-y-3">
			<h4 class={labelClass}>{$_('merchant.links')}</h4>
			<div class="flex flex-wrap gap-2">
				{#if data.website}
					<a href={withProtocol(data.website, 'https://')} target="_blank" rel="noopener noreferrer" class={chip}>
						<Icon w="16" h="16" icon="language" type="material" />
						{$_('merchant.website')}
					</a>
				{/if}
				{#if data.instagram}
					<a href={withProtocol(data.instagram, 'https://instagram.com/')} target="_blank" rel="noopener noreferrer" class={chip}>
						<Icon w="16" h="16" icon="instagram" type="fa" />
						{$_('merchant.socialInstagram')}
					</a>
				{/if}
				{#if data.facebook}
					<a href={withProtocol(data.facebook, 'https://facebook.com/')} target="_blank" rel="noopener noreferrer" class={chip}>
						<Icon w="16" h="16" icon="facebook" type="fa" />
						{$_('merchant.socialFacebook')}
					</a>
				{/if}
				{#if data.twitter}
					<a href={withProtocol(data.twitter, 'https://twitter.com/')} target="_blank" rel="noopener noreferrer" class={chip}>
						<Icon w="16" h="16" icon="x-twitter" type="fa" />
						{$_('merchant.socialX')}
					</a>
				{/if}
				{#if data.email}
					<a href={`mailto:${data.email}`} class={chip}>
						<Icon w="16" h="16" icon="email" type="material" />
						{$_('merchant.email')}
					</a>
				{/if}
				{#if payHref}
					<a href={payHref} target="_blank" rel="noopener noreferrer" class={chip}>
						<Icon w="16" h="16" icon="bolt" type="material" />
						{$_('merchant.pay')}
					</a>
				{/if}
			</div>
		</div>
	{/if}

	<!-- communities -->
	{#if data.areas && data.areas.length}
		<div class="space-y-3">
			<h4 class={labelClass}>{$_('nav.communities')}</h4>
			<div class="flex flex-wrap gap-4">
				{#each data.areas as community (community.id)}
					<a
						href={resolve(`/community/${encodeURIComponent(community.id)}`)}
						class="flex w-20 flex-col items-center gap-1 transition-transform hover:scale-105"
					>
						<img
							src={areaIconSrc(community.tags['icon:square'])}
							alt={$_('aria.logoAlt')}
							loading="lazy"
							class="h-16 w-16 rounded-full object-cover"
							on:error={function () {
								this.src = '/images/bitcoin.svg';
							}}
						/>
						<span class="text-center text-xs font-semibold text-body dark:text-white/80">
							{community.tags.name}
						</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- tagger tools -->
	<TaggerTools osmTags={data.osmTags} issues={data.issues} osmViewUrl={data.osmViewUrl} />
</div>
