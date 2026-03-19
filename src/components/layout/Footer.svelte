<script lang="ts">
import LanguageModal from "$components/LanguageModal.svelte";
import SocialLink from "$components/SocialLink.svelte";
import { _ } from "$lib/i18n";
import { socials } from "$lib/store";

import { env } from "$env/dynamic/public";

// Left column: user-facing resources
const leftLinks = [
	{ link: "/bitcoin.pdf", nameKey: "footer.whitePaper" },
	{
		link: "https://bitcoin.rocks/business/",
		nameKey: "footer.bitcoinForBusiness",
		external: true,
	},
	{
		link: env.PUBLIC_UMAMI_URL || "https://umami.btcmap.org",
		nameKey: "footer.analytics",
		external: true,
	},
	{ link: "/cypherpunks-manifesto.pdf", nameKey: "footer.cypherpunks" },
];

// Right column: company & legal
const rightLinks = [
	{ link: "/about-us", nameKey: "footer.aboutUs" },
	{ link: "/media", nameKey: "footer.media" },
	{ link: "/license", nameKey: "footer.license" },
	{ link: "/privacy-policy", nameKey: "footer.privacy" },
	{
		link: "https://stats.uptimerobot.com/7kgEVtzlV1",
		nameKey: "footer.status",
		external: true,
	},
];
</script>

<footer class="mx-auto w-full max-w-6xl items-center justify-between space-y-5 pb-5 xl:flex xl:items-start xl:space-y-0">
	<div class="flex flex-wrap justify-center gap-5 xl:block xl:space-x-5">
		<SocialLink url={$socials.matrix} social="matrix" />
		<SocialLink url={$socials.github} social="github" />
		<SocialLink url={$socials.amboss} social="amboss" />
		<SocialLink url={$socials.nostr} social="nostr" />
		<SocialLink url={$socials.x} social="x" />
	</div>

	<nav aria-label={$_("footer.nav")} class="mx-auto flex flex-col items-center gap-8 xl:mx-0 xl:flex-row xl:items-start xl:gap-x-40">
		<div class="flex flex-col items-center gap-y-2 xl:items-start">
			<LanguageModal />
			{#each leftLinks as link (link.link)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={link.link}
					target={link.external ? '_blank' : null}
					rel={link.external ? 'noopener noreferrer' : null}
					class="text-sm text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link"
				>
					{$_(link.nameKey)}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</div>
		<div class="flex flex-col items-center gap-y-2 xl:items-start">
			{#each rightLinks as link (link.link)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={link.link}
					target={link.external ? '_blank' : null}
					rel={link.external ? 'noopener noreferrer' : null}
					class="text-sm text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link"
				>
					{$_(link.nameKey)}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</div>
	</nav>
</footer>
