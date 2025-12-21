<script lang="ts">
	import type { SocialIconName } from './types';
	import amboss from './socials/amboss.svg?raw';
	import discord from './socials/discord.svg?raw';
	import email from './socials/email.svg?raw';
	import facebook from './socials/facebook.svg?raw';
	import github from './socials/github.svg?raw';
	import instagram from './socials/instagram.svg?raw';
	import linkedin from './socials/linkedin.svg?raw';
	import matrix from './socials/matrix.svg?raw';
	import nostr from './socials/nostr.svg?raw';
	import reddit from './socials/reddit.svg?raw';
	import signal from './socials/signal.svg?raw';
	import telegram from './socials/telegram.svg?raw';
	import website from './socials/website.svg?raw';
	import whatsapp from './socials/whatsapp.svg?raw';
	import x from './socials/x.svg?raw';
	import youtube from './socials/youtube.svg?raw';

	const icons: Record<SocialIconName, string> = {
		amboss,
		discord,
		email,
		facebook,
		github,
		instagram,
		linkedin,
		matrix,
		nostr,
		reddit,
		signal,
		telegram,
		website,
		whatsapp,
		x,
		youtube
	};

	export let icon: SocialIconName;
	export let w = '24';
	export let h = '24';
	let className: string | undefined = undefined;
	export { className as class };
</script>

<span
	class={className}
	style="display: block; width: {w}px; height: {h}px;"
	role="img"
	aria-hidden="true"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags - SVG from trusted local files -->
	{@html icons[icon]}
</span>

<style>
	span :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
