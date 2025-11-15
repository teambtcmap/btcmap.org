<script lang="ts">
	export let website: undefined | string = undefined;
	export let email: undefined | string = undefined;
	export let nostr: undefined | string = undefined;
	export let twitter: undefined | string = undefined;
	export let secondTwitter: undefined | string = undefined;
	export let meetup: undefined | string = undefined;
	export let eventbrite: undefined | string = undefined;
	export let telegram: undefined | string = undefined;
	export let discord: undefined | string = undefined;
	export let youtube: undefined | string = undefined;
	export let github: undefined | string = undefined;
	export let reddit: undefined | string = undefined;
	export let instagram: undefined | string = undefined;
	export let whatsapp: undefined | string = undefined;
	export let facebook: undefined | string = undefined;
	export let linkedin: undefined | string = undefined;
	export let rss: undefined | string = undefined;
	export let signal: undefined | string = undefined;
	export let simplex: undefined | string = undefined;

	export let style: undefined | string = undefined;

	import Icon from '$components/Icon.svelte';
</script>

<div class="flex flex-wrap items-center justify-center {style || ''}">
	{#if website}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a href={website} target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-bitcoin">
				<Icon type="fa" icon="globe" w="28" h="28" style="text-white" />
			</span>
		</a>
	{/if}
	{#if email}
		<a href="mailto:{email}" target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#53C5D5]">
				<Icon type="fa" icon="envelope" w="28" h="28" style="text-white" />
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
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black">
				<Icon w="25" h="25" icon="x" type="socials" style="text-white" />
			</span>
		</a>
	{/if}
	{#if secondTwitter}
		<a href={secondTwitter} target="_blank" rel="noreferrer" class="m-1">
			<span class="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black">
				<Icon w="25" h="25" icon="x" type="socials" style="text-white" />
			</span>
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
				<Icon type="fa" icon="rss" w="28" h="28" style="text-white" />
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
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<img src="/icons/socials/simplex.jpg" alt="simplex" class="h-10 w-10 rounded-full" />
		</a>
	{/if}
</div>
