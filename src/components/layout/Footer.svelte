<script lang="ts">
import Icon from "$components/Icon.svelte";
import SocialLink from "$components/SocialLink.svelte";
import { trackEvent } from "$lib/analytics";
import { _, locale } from "$lib/i18n";
import { socials } from "$lib/store";

import { env } from "$env/dynamic/public";

function switchLanguage(newLocale: string) {
	trackEvent("language_switch", { language: newLocale });
	locale.set(newLocale);
	if (typeof window !== "undefined") {
		localStorage.setItem("language", newLocale);
	}
}

// Links with translation keys (translations are applied in template using $_())
const links = [
	{ link: "/about-us", nameKey: "footer.aboutUs" },
	{ link: "/media", nameKey: "footer.media" },
	{ link: "/license", nameKey: "footer.license" },
	{ link: "/privacy-policy", nameKey: "footer.privacy" },
	{ link: "https://stats.uptimerobot.com/7kgEVtzlV1", name: "Status" },
	...(env.PUBLIC_UMAMI_URL
		? [{ link: env.PUBLIC_UMAMI_URL, name: "Analytics", external: true }]
		: []),
	{
		link: "https://bitcoin.rocks/business/",
		nameKey: "footer.bitcoinForBusiness",
		external: true,
	},
	{ link: "/bitcoin.pdf", name: "White Paper" },
	{ link: "/cypherpunks-manifesto.pdf", name: "Cypherpunks" },
];
</script>

<footer class="flex w-full flex-col items-center justify-between gap-4 pb-5 xl:flex-row xl:flex-nowrap xl:gap-0">
	<div class="flex flex-nowrap justify-center gap-3 xl:gap-4">
		<SocialLink url={$socials.matrix} social="matrix" />
		<SocialLink url={$socials.github} social="github" />
		<SocialLink url={$socials.amboss} social="amboss" />
		<SocialLink url={$socials.nostr} social="nostr" />
		<SocialLink url={$socials.x} social="x" />
	</div>

	<div class="flex flex-wrap justify-center gap-x-2 gap-y-2 xl:flex-nowrap xl:items-center">
		<!-- Language Selector -->
		<span class="shrink-0 text-sm">
			<Icon
				type="material"
				icon="translate"
				w="16"
				h="16"
				class="inline-block align-text-bottom text-link dark:text-white/50"
			/>
			<button
				type="button"
				on:click={() => switchLanguage('en')}
				disabled={$locale === 'en'}
				aria-label="Switch to English"
				class="
					{$locale === 'en'
					? 'cursor-default font-bold text-body underline dark:text-white/50'
					: 'text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link'}
				"
			>
				EN
			</button>
			<span class="text-body dark:text-white/50">/</span>
			<button
				type="button"
				on:click={() => switchLanguage('pt-BR')}
				disabled={$locale === 'pt-BR'}
				aria-label="Mudar para Português"
				class="
					{$locale === 'pt-BR'
					? 'cursor-default font-bold text-body underline dark:text-white/50'
					: 'text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link'}
				"
			>
				PT
			</button>
			<span class="text-body dark:text-white/50">/</span>
			<button
				type="button"
				on:click={() => switchLanguage('bg')}
				disabled={$locale === 'bg'}
				aria-label="Преминаване към български"
				class="
					{$locale === 'bg'
					? 'cursor-default font-bold text-body underline dark:text-white/50'
					: 'text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link'}
				"
			>
				BG
			</button>
		</span>

		{#each links as link (link.link)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={link.link}
				target={link.external ? '_blank' : null}
				rel={link.external ? 'noopener noreferrer' : null}
				class="shrink-0 whitespace-nowrap text-sm text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link"
			>
				{link.nameKey ? $_(link.nameKey) : link.name}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</div>
</footer>
