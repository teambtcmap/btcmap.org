<script>
	import { Tip, SponsorBadge, Socials } from '$comp';

	export let id;
	export let tags;

	$: image = tags['icon:square'] && tags['icon:square'];
	$: website = tags['contact:website'] && tags['contact:website'];
	$: email = tags['contact:email'] && tags['contact:email'];
	$: nostr = tags['contact:nostr'] && tags['contact:nostr'];
	$: twitter = tags['contact:twitter'] && tags['contact:twitter'];
	$: secondTwitter = tags['contact:second_twitter'] && tags['contact:second_twitter'];
	$: meetup = tags['contact:meetup'] && tags['contact:meetup'];
	$: eventbrite = tags['contact:eventbrite'] && tags['contact:eventbrite'];
	$: telegram = tags['contact:telegram'] && tags['contact:telegram'];
	$: discord = tags['contact:discord'] && tags['contact:discord'];
	$: youtube = tags['contact:youtube'] && tags['contact:youtube'];
	$: github = tags['contact:github'] && tags['contact:github'];
	$: reddit = tags['contact:reddit'] && tags['contact:reddit'];
	$: instagram = tags['contact:instagram'] && tags['contact:instagram'];
	$: whatsapp = tags['contact:whatsapp'] && tags['contact:whatsapp'];
	$: facebook = tags['contact:facebook'] && tags['contact:facebook'];
	$: linkedin = tags['contact:linkedin'] && tags['contact:linkedin'];
	$: rss = tags['contact:rss'] && tags['contact:rss'];
	$: signal = tags['contact:signal'] && tags['contact:signal'];
	$: tip =
		(tags['tips:lightning_address'] && {
			destination: tags['tips:lightning_address'],
			type: 'address'
		}) ||
		(tags['tips:url'] && { destination: tags['tips:url'], type: 'url' });
</script>

<div
	class="rounded-3xl border border-statBorder shadow transition-shadow hover:shadow-2xl dark:bg-white/10"
>
	<div class="my-4 space-y-2 p-4">
		<a href="/community/{id}" class="space-y-2 text-link transition-colors hover:text-hover">
			<img
				src={image ? image : '/images/communities/bitcoin.svg'}
				alt={tags.name}
				class="mx-auto h-20 w-20 rounded-full object-cover"
				onerror="this.src='/images/communities/bitcoin.svg'"
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
		style="border-t border-t-statBorder p-4 w-full"
	/>
</div>
