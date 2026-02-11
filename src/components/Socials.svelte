<script lang="ts">
	export let website: undefined | string = undefined;
	export let email: undefined | string = undefined;
	export let phone: undefined | string = undefined;
	export let nostr: undefined | string = undefined;
	export let twitter: undefined | string = undefined;
	export let meetup: undefined | string = undefined;
	export let telegram: undefined | string = undefined;
	export let discord: undefined | string = undefined;
	export let youtube: undefined | string = undefined;
	export let github: undefined | string = undefined;
	export let matrix: undefined | string = undefined;
	export let geyser: undefined | string = undefined;
	export let eventbrite: undefined | string = undefined;
	export let reddit: undefined | string = undefined;
	export let simplex: undefined | string = undefined;
	export let instagram: undefined | string = undefined;
	export let whatsapp: undefined | string = undefined;
	export let facebook: undefined | string = undefined;
	export let linkedin: undefined | string = undefined;
	export let rss: undefined | string = undefined;
	export let signal: undefined | string = undefined;

	export let style: undefined | string = undefined;

	import Icon from '$components/Icon.svelte';
	import IconSocials from '$lib/icons/IconSocials.svelte';
	import { sanitizeUrl } from '$lib/utils';

	// Sanitize URLs to prevent XSS from malicious protocols like javascript:
	$: safeWebsite = sanitizeUrl(website);
	$: safeTwitter = sanitizeUrl(twitter);
	$: safeMeetup = sanitizeUrl(meetup);
	$: safeTelegram = sanitizeUrl(telegram);
	$: safeDiscord = sanitizeUrl(discord);
	$: safeYoutube = sanitizeUrl(youtube);
	$: safeGithub = sanitizeUrl(github);
	$: safeMatrix = sanitizeUrl(matrix);
	$: safeGeyser = sanitizeUrl(geyser);
	$: safeEventbrite = sanitizeUrl(eventbrite);
	$: safeReddit = sanitizeUrl(reddit);
	$: safeSimplex = sanitizeUrl(simplex);
	$: safeInstagram = sanitizeUrl(instagram);
	$: safeWhatsapp = sanitizeUrl(whatsapp);
	$: safeFacebook = sanitizeUrl(facebook);
	$: safeLinkedin = sanitizeUrl(linkedin);
	$: safeRss = sanitizeUrl(rss);
	$: safeSignal = sanitizeUrl(signal);
</script>

<div class="flex flex-wrap items-center justify-center {style || ''}">
	{#if safeWebsite}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a href={safeWebsite} target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-bitcoin">
				<Icon type="fa" icon="globe" w="28" h="28" class="text-white" />
			</span>
		</a>
	{/if}
	{#if email}
		<a href="mailto:{email}" target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#53C5D5]">
				<Icon type="fa" icon="envelope" w="28" h="28" class="text-white" />
			</span>
		</a>
	{/if}
	{#if phone}
		<a href="tel:{phone}" target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-green-600">
				<Icon type="fa" icon="phone" w="28" h="28" class="text-white" />
			</span>
		</a>
	{/if}
	{#if nostr}
		<a href="https://nostr.com/{nostr}" target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-nostr">
				<IconSocials w="28" h="28" icon="nostr" class="text-white" />
			</span>
		</a>
	{/if}
	{#if safeTwitter}
		<a href={safeTwitter} target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black">
				<IconSocials w="25" h="25" icon="x" class="text-white" />
			</span>
		</a>
	{/if}
	{#if safeMeetup}
		<a href={safeMeetup} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/meetup.jpg" alt="meetup" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if safeTelegram}
		<a href={safeTelegram} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/telegram.svg" alt="telegram" />
		</a>
	{/if}
	{#if safeDiscord}
		<a href={safeDiscord} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/discord.svg" alt="discord" />
		</a>
	{/if}
	{#if safeYoutube}
		<a href={safeYoutube} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/youtube.svg" alt="youtube" />
		</a>
	{/if}
	{#if safeGithub}
		<a href={safeGithub} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/github.svg" alt="github" />
		</a>
	{/if}
	{#if safeMatrix}
		<a href={safeMatrix} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/matrix.svg" alt="matrix" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if safeGeyser}
		<a href={safeGeyser} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/geyser.jpg" alt="geyser" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if safeEventbrite}
		<a href={safeEventbrite} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/eventbrite.png" alt="eventbrite" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if safeReddit}
		<a href={safeReddit} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/reddit.svg" alt="reddit" />
		</a>
	{/if}
	{#if safeSimplex}
		<a href={safeSimplex} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/simplex.jpg" alt="simplex" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if safeInstagram}
		<a href={safeInstagram} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/instagram.svg" alt="instagram" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
	{#if safeWhatsapp}
		<a href={safeWhatsapp} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/whatsapp.svg" alt="whatsapp" />
		</a>
	{/if}
	{#if safeFacebook}
		<a href={safeFacebook} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/facebook.svg" alt="facebook" />
		</a>
	{/if}
	{#if safeLinkedin}
		<a href={safeLinkedin} target="_blank" rel="noreferrer" class="m-1">
			<img src="/icons/socials/linkedin.svg" alt="linkedin" />
		</a>
	{/if}
	{#if safeRss}
		<a href={safeRss} target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-orange-500">
				<Icon type="fa" icon="rss" w="28" h="28" class="text-white" />
			</span>
		</a>
	{/if}
	{#if safeSignal}
		<a href={safeSignal} target="_blank" rel="noreferrer" class="m-1">
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<img src="/icons/socials/signal.svg" alt="signal" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
</div>
