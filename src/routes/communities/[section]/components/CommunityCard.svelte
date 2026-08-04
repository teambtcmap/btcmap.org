<script lang="ts">
import OrgBadge from "$components/OrgBadge.svelte";
import Socials from "$components/Socials.svelte";
import SponsorBadge from "$components/SponsorBadge.svelte";
import TextLink from "$components/TextLink.svelte";
import Tip from "$components/Tip.svelte";
import { extractContacts } from "$lib/area/contacts";
import { getOrganizationDisplayName } from "$lib/organizationDisplayNames";
import type { AreaTags } from "$lib/types";
import { TipType } from "$lib/types";
import { areaIconSrc } from "$lib/utils";

import { resolve } from "$app/paths";

export let id: string;
export let tags: AreaTags;

$: image = tags["icon:square"] && tags["icon:square"];
$: contacts = extractContacts(tags);
$: hasContact = Object.keys(contacts).length > 0;
$: tip =
	(tags["tips:lightning_address"] && {
		destination: tags["tips:lightning_address"],
		type: TipType.Address,
	}) ||
	(tags["tips:url"] && { destination: tags["tips:url"], type: TipType.Url });
</script>

<div
	class="rounded-3xl border border-gray-300 shadow transition-shadow hover:shadow-2xl dark:border-white/95 dark:bg-white/10"
>
	<div class="my-4 space-y-2 p-4">
		<TextLink
			link={resolve(`/community/${encodeURIComponent(id)}`)}
			style="space-y-2"
		>
			<img
				loading="lazy"
				src={areaIconSrc(id, image)}
				alt={tags.name}
				class="mx-auto h-20 w-20 rounded-full object-cover"
				on:error={function () {
					this.src = '/images/bitcoin.svg';
				}}
			/>

			<span class="block text-center text-lg font-semibold">{tags.name}</span>
		</TextLink>
		{#if tags.organization}
			<OrgBadge org={getOrganizationDisplayName(tags.organization)} />
		{/if}
		{#if tags.sponsor}
			<SponsorBadge />
		{/if}
		{#if tip}
			<Tip destination={tip.destination} type={tip.type} class="mx-auto block" />
		{/if}
	</div>

	{#if hasContact}
		<Socials
			{contacts}
			style="border-t border-t-gray-200 p-4 w-full dark:border-t-white/95"
		/>
	{/if}
</div>
