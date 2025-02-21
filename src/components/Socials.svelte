<script lang="ts">


	import { Icon } from '$lib/comp';
	interface Props {
		website?: undefined | string;
		email?: undefined | string;
		nostr?: undefined | string;
		twitter?: undefined | string;
		secondTwitter?: undefined | string;
		meetup?: undefined | string;
		eventbrite?: undefined | string;
		telegram?: undefined | string;
		discord?: undefined | string;
		youtube?: undefined | string;
		github?: undefined | string;
		reddit?: undefined | string;
		instagram?: undefined | string;
		whatsapp?: undefined | string;
		facebook?: undefined | string;
		linkedin?: undefined | string;
		rss?: undefined | string;
		signal?: undefined | string;
		simplex?: undefined | string;
		style?: undefined | string;
	}

	let {
		website = undefined,
		email = undefined,
		nostr = undefined,
		twitter = undefined,
		secondTwitter = undefined,
		meetup = undefined,
		eventbrite = undefined,
		telegram = undefined,
		discord = undefined,
		youtube = undefined,
		github = undefined,
		reddit = undefined,
		instagram = undefined,
		whatsapp = undefined,
		facebook = undefined,
		linkedin = undefined,
		rss = undefined,
		signal = undefined,
		simplex = undefined,
		style = undefined
	}: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-center {style || ''}">
	{#if website}
		<a href={website} target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-bitcoin">
				<i class="fa-solid fa-globe h-7 w-7 text-white"></i>
			</span>
		</a>
	{/if}
	{#if email}
		<a href="mailto:{email}" target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#53C5D5]">
				<i class="fa-solid fa-envelope h-7 w-7 text-white"></i>
			</span>
		</a>
	{/if}
	{#if nostr}
		<a href="https://nostr.com/{nostr}" target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-nostr">
				<Icon w="28" h="28" icon="nostr" type="socials" style="text-white" />
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
	{#if instagram}
		<a href={instagram} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/instagram.svg" alt="instagram" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if whatsapp}
		<a href={whatsapp} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/whatsapp.svg" alt="whatsapp" />
		</a>
	{/if}
	{#if facebook}
		<a href={facebook} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/facebook.svg" alt="facebook" />
		</a>
	{/if}
	{#if linkedin}
		<a href={linkedin} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/linkedin.svg" alt="linkedin" />
		</a>
	{/if}
	{#if rss}
		<a href={rss} target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-orange-500">
				<i class="fa-solid fa-rss h-7 w-7 text-white"></i>
			</span>
		</a>
	{/if}
	{#if signal}
		<a href={signal} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/signal.svg" alt="signal" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if simplex}
		<a href={simplex} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/simplex.jpg" alt="simplex" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
</div>
