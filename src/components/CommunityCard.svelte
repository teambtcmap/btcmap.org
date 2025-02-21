<script lang="ts">
	import { Socials, SponsorBadge, Tip } from '$lib/comp';
	import { TipType, type AreaTags } from '$lib/types';

	interface Props {
		id: string;
		tags: AreaTags;
	}

	let { id, tags }: Props = $props();

	let image = $derived(tags['icon:square'] && tags['icon:square']);
	let website = $derived(tags['contact:website'] && tags['contact:website']);
	let email = $derived(tags['contact:email'] && tags['contact:email']);
	let nostr = $derived(tags['contact:nostr'] && tags['contact:nostr']);
	let twitter = $derived(tags['contact:twitter'] && tags['contact:twitter']);
	let secondTwitter = $derived(tags['contact:second_twitter'] && tags['contact:second_twitter']);
	let meetup = $derived(tags['contact:meetup'] && tags['contact:meetup']);
	let eventbrite = $derived(tags['contact:eventbrite'] && tags['contact:eventbrite']);
	let telegram = $derived(tags['contact:telegram'] && tags['contact:telegram']);
	let discord = $derived(tags['contact:discord'] && tags['contact:discord']);
	let youtube = $derived(tags['contact:youtube'] && tags['contact:youtube']);
	let github = $derived(tags['contact:github'] && tags['contact:github']);
	let reddit = $derived(tags['contact:reddit'] && tags['contact:reddit']);
	let instagram = $derived(tags['contact:instagram'] && tags['contact:instagram']);
	let whatsapp = $derived(tags['contact:whatsapp'] && tags['contact:whatsapp']);
	let facebook = $derived(tags['contact:facebook'] && tags['contact:facebook']);
	let linkedin = $derived(tags['contact:linkedin'] && tags['contact:linkedin']);
	let rss = $derived(tags['contact:rss'] && tags['contact:rss']);
	let signal = $derived(tags['contact:signal'] && tags['contact:signal']);
	let simplex = $derived(tags['contact:simplex'] && tags['contact:simplex']);
	let tip =
		$derived((tags['tips:lightning_address'] && {
			destination: tags['tips:lightning_address'],
			type: TipType.Address
		}) ||
		(tags['tips:url'] && { destination: tags['tips:url'], type: TipType.Url }));
</script>

<div
	class="rounded-3xl border border-statBorder shadow transition-shadow hover:shadow-2xl dark:bg-white/10"
>
	<div class="my-4 space-y-2 p-4">
		<a href="/community/{id}" class="space-y-2 text-link transition-colors hover:text-hover">
			<img
				src={image
					? `https://btcmap.org/.netlify/images?url=${image}&fit=cover&w=256&h=256`
					: '/images/bitcoin.svg'}
				alt={tags.name}
				class="mx-auto h-20 w-20 rounded-full object-cover"
				onerror={function () {
					this.src = '/images/bitcoin.svg';
				}}
			/>

			<span class="block text-center text-lg font-semibold">{tags.name}</span>
		</a>
		{#if tags.sponsor}
			<SponsorBadge />
		{/if}
		{#if tip}
			<Tip destination={tip.destination} type={tip.type} style="mx-auto block" />
		{/if}
	</div>

	<Socials
		{website}
		{email}
		{nostr}
		{twitter}
		{secondTwitter}
		{meetup}
		{eventbrite}
		{telegram}
		{discord}
		{youtube}
		{github}
		{reddit}
		{instagram}
		{whatsapp}
		{facebook}
		{linkedin}
		{rss}
		{signal}
		{simplex}
		style="border-t border-t-statBorder p-4 w-full"
	/>
</div>
