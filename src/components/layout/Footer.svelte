<script lang="ts">
import Icon from "$components/Icon.svelte";
import LanguageModal from "$components/LanguageModal.svelte";
import SocialLink from "$components/SocialLink.svelte";
import { _ } from "$lib/i18n";
import { socials } from "$lib/store";

import { env } from "$env/dynamic/public";

// Links with translation keys (translations are applied in template using $_())
const links = [
	{ link: "/about-us", nameKey: "footer.aboutUs" },
	{ link: "/media", nameKey: "footer.media" },
	{ link: "/license", nameKey: "footer.license" },
	{ link: "/privacy-policy", nameKey: "footer.privacy" },
	{
		link: "https://stats.uptimerobot.com/7kgEVtzlV1",
		nameKey: "footer.status",
		external: true,
	},
	...(env.PUBLIC_UMAMI_URL
		? [
				{
					link: env.PUBLIC_UMAMI_URL,
					nameKey: "footer.analytics",
					external: true,
				},
			]
		: []),
	{
		link: "https://bitcoin.rocks/business/",
		nameKey: "footer.bitcoinForBusiness",
		external: true,
	},
	{ link: "/bitcoin.pdf", nameKey: "footer.whitePaper" },
	{ link: "/cypherpunks-manifesto.pdf", nameKey: "footer.cypherpunks" },
];
</script>

<footer class="w-full items-center justify-between space-y-5 pb-5 xl:flex xl:space-y-0">
	<div class="flex flex-wrap justify-center gap-5 xl:block xl:space-x-5">
		<SocialLink url={$socials.matrix} social="matrix" />
		<SocialLink url={$socials.github} social="github" />
		<SocialLink url={$socials.amboss} social="amboss" />
		<SocialLink url={$socials.nostr} social="nostr" />
		<SocialLink url={$socials.x} social="x" />
	</div>

	<div class="flex flex-wrap justify-center gap-x-3 xl:flex xl:space-x-5">
		<span class="mx-1.5"><LanguageModal /></span>

		{#each links as link (link.link)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={link.link}
				target={link.external ? '_blank' : null}
				rel={link.external ? 'noopener noreferrer' : null}
				class="mx-1.5 mb-2.5 text-sm text-link transition-colors last:mb-0 hover:text-hover xl:mb-0 dark:text-white/50 dark:hover:text-link"
			>
				{$_(link.nameKey)}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</div>
</footer>
