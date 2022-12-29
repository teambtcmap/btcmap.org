<script>
	import { Tip, SponsorBadge } from '$comp';

	export let id;
	export let tags;

	$: image = tags['icon:square'] && tags['icon:square'];
	$: website = tags['contact:website'] && tags['contact:website'];
	$: twitter = tags['contact:twitter'] && tags['contact:twitter'];
	$: secondTwitter = tags['contact:second_twitter'] && tags['contact:second_twitter'];
	$: telegram = tags['contact:telegram'] && tags['contact:telegram'];
	$: discord = tags['contact:discord'] && tags['contact:discord'];
	$: youtube = tags['contact:youtube'] && tags['contact:youtube'];
	$: github = tags['contact:github'] && tags['contact:github'];
	$: tip =
		(tags['tips:lightning_address'] && {
			destination: tags['tips:lightning_address'],
			type: 'address'
		}) ||
		(tags['tips:url'] && { destination: tags['tips:url'], type: 'url' });
</script>

<div class="border border-statBorder rounded-3xl shadow hover:shadow-2xl transition-shadow">
	<div class="my-4 p-4 space-y-2">
		<a href="/community/{id}" class="text-link hover:text-hover space-y-2 transition-colors">
			<img
				src={image ? image : '/images/communities/bitcoin.svg'}
				alt={tags.name}
				class="w-20 h-20 object-cover rounded-full mx-auto"
			/>

			<span class="text-center text-lg font-semibold block">{tags.name}</span>
		</a>
		{#if tags.sponsor}
			<SponsorBadge />
		{/if}
		{#if tip}
			<Tip destination={tip.destination} type={tip.type} style="mx-auto block" />
		{/if}
	</div>

	<div class="p-4 w-full flex flex-wrap justify-center items-center border-t border-t-statBorder">
		{#if website}
			<a href={website} target="_blank" rel="noreferrer" class="m-1">
				<span class="bg-bitcoin w-[40px] h-[40px] flex justify-center items-center rounded-full">
					<i class="text-white w-7 h-7 fa-solid fa-globe" />
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
	</div>
</div>
