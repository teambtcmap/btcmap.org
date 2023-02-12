<script>
	import { Tip, SponsorBadge, OrgBadge } from '$comp';

	export let id;
	export let tags;

	$: image = tags['icon:square'] && tags['icon:square'];
	$: website = tags['contact:website'] && tags['contact:website'];
	$: twitter = tags['contact:twitter'] && tags['contact:twitter'];
	$: secondTwitter = tags['contact:second_twitter'] && tags['contact:second_twitter'];
	$: meetup = tags['contact:meetup'] && tags['contact:meetup'];
	$: eventbrite = tags['contact:eventbrite'] && tags['contact:eventbrite'];
	$: telegram = tags['contact:telegram'] && tags['contact:telegram'];
	$: discord = tags['contact:discord'] && tags['contact:discord'];
	$: youtube = tags['contact:youtube'] && tags['contact:youtube'];
	$: github = tags['contact:github'] && tags['contact:github'];
	$: reddit = tags['contact:reddit'] && tags['contact:reddit'];
	$: tip =
		(tags['tips:lightning_address'] && {
			destination: tags['tips:lightning_address'],
			type: 'address'
		}) ||
		(tags['tips:url'] && { destination: tags['tips:url'], type: 'url' });
</script>

<div class="rounded-3xl border border-statBorder shadow transition-shadow hover:shadow-2xl">
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
		{#if tags.organization}
			<OrgBadge org={tags.organization} />
		{/if}
		{#if tags.sponsor}
			<SponsorBadge />
		{/if}
		{#if tip}
			<Tip destination={tip.destination} type={tip.type} style="mx-auto block" />
		{/if}
	</div>

	<div class="flex w-full flex-wrap items-center justify-center border-t border-t-statBorder p-4">
		{#if website}
			<a href={website} target="_blank" rel="noreferrer" class="m-1">
				<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-bitcoin">
					<i class="fa-solid fa-globe h-7 w-7 text-white" />
				</span>
			</a>
		{/if}
		{#if twitter}
			<a href={twitter} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/twitter.svg" alt="twitter" />
			</a>
		{/if}
		{#if secondTwitter}
			<a href={secondTwitter} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/twitter.svg" alt="twitter" />
			</a>
		{/if}
		{#if meetup}
			<a href={meetup} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/meetup.jpg" alt="meetup" class="h-10 w-10 rounded-full" />
			</a>
		{/if}
		{#if eventbrite}
			<a href={eventbrite} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/eventbrite.png" alt="eventbrite" class="h-10 w-10 rounded-full" />
			</a>
		{/if}
		{#if telegram}
			<a href={telegram} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/telegram.svg" alt="telegram" />
			</a>
		{/if}
		{#if discord}
			<a href={discord} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/discord.svg" alt="discord" />
			</a>
		{/if}
		{#if youtube}
			<a href={youtube} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/youtube.svg" alt="youtube" />
			</a>
		{/if}
		{#if github}
			<a href={github} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/github.svg" alt="github" />
			</a>
		{/if}
		{#if reddit}
			<a href={reddit} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/reddit.svg" alt="reddit" />
			</a>
		{/if}
	</div>
</div>
