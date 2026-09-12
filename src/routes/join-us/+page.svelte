<script lang="ts">
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";

// The native onboarding guide (#1376): the content of Igor's
// join.btcmap.org proof of concept, rebuilt in the app's own design,
// fully localized, and wired to the live pages it describes. It
// replaces the old /tagger-onboarding application form — the guide IS
// the onboarding; the form was a gate. One analytics event with a
// target property keeps the funnel readable without seven
// near-identical names.
const track = (target: string) => () =>
	trackEvent("join_us_link_click", { target });

type StepLink = {
	href: string;
	label: string;
	target: string;
	external?: boolean;
};
type Step = { title: string; body?: string; links: StepLink[] };

// $derived so a language switch re-renders the guide.
const steps: Step[] = $derived([
	{
		title: $_("joinUs.step1Title"),
		links: [
			{
				href: "/countries",
				label: $_("joinUs.browseCountries"),
				target: "countries",
			},
			{
				href: "/communities",
				label: $_("joinUs.browseCommunities"),
				target: "communities",
			},
		],
	},
	{
		// Named exactly as the area pages label the tab in this language.
		title: $_("joinUs.step2Title", {
			values: { tab: $_("area.sections.maintain") },
		}),
		body: $_("joinUs.step2Body"),
		links: [
			{
				href: "/country/th/maintain",
				label: $_("joinUs.step2Example"),
				target: "maintain-example",
			},
		],
	},
	{
		title: $_("joinUs.step3Title"),
		body: $_("joinUs.step3Body"),
		links: [],
	},
	{
		title: $_("joinUs.step4Title"),
		body: $_("joinUs.step4Body"),
		links: [
			{
				href: "https://www.openstreetmap.org/user/new",
				label: $_("joinUs.step4Cta"),
				target: "osm-signup",
				external: true,
			},
		],
	},
	{
		title: $_("joinUs.step5Title"),
		body: $_("joinUs.step5Body"),
		links: [
			{
				href: "https://matrix.to/#/#btcmap-taggers:matrix.org",
				label: "#btcmap-taggers:matrix.org",
				target: "matrix",
				external: true,
			},
		],
	},
]);
</script>

<svelte:head>
	<title>BTC Map - {$_('nav.joinUs')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="og:title" content="BTC Map - {$_('nav.joinUs')}" />
	<meta name="twitter:title" content="BTC Map - {$_('nav.joinUs')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<!-- The gradient treatment needs the client-side theme, but the SSR
     branch still renders a real, localized h1 (plain theme classes)
     instead of the skeleton — crawlers and no-JS readers get the
     primary heading; hydration just swaps the classes. -->
{#if typeof window !== 'undefined'}
	<h1
		class="{$theme === 'dark'
			? 'text-white'
			: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
	>
		{$_('joinUs.hero')}
	</h1>
{:else}
	<h1
		class="mt-10 text-center text-4xl font-semibold text-primary md:text-5xl dark:text-white"
	>
		{$_('joinUs.hero')}
	</h1>
{/if}

<section id="join-us" class="mx-auto mt-10 w-full pb-20 md:w-[600px] md:pb-32">
	<p class="mb-6 text-center text-primary dark:text-white">
		{$_('joinUs.intro')}
	</p>

	<div
		class="mb-10 rounded-2xl border-2 border-input p-4 text-sm text-body dark:text-offwhite"
	>
		<span class="font-semibold">{$_('joinUs.openData')}</span>
		<!-- The copy is split around the link instead of {@html}-injecting
		     an anchor: an {@html} block whose SSR (English) and client
		     (user locale) values differ gets frozen at the server value on
		     hydration (svelte's hydration_html_changed). Every locale ends
		     this sentence on the link, so the split reads naturally. -->
		{$_('joinUs.openDataPre')}
		<a
			href="https://www.openstreetmap.org/"
			target="_blank"
			rel="noopener noreferrer"
			class="font-semibold text-link transition-colors hover:text-hover"
			onclick={track('osm-about')}
		>OpenStreetMap</a>. {$_('joinUs.openDataPost')}
	</div>

	<ol class="space-y-8">
		{#each steps as step, index (step.title)}
			<li class="flex items-start gap-4">
				<span
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-link font-semibold text-white"
					aria-hidden="true"
				>
					{index + 1}
				</span>
				<div>
					<h2 class="font-semibold text-primary dark:text-white">
						{step.title}
					</h2>
					{#if step.body}
						<p class="mt-1 text-sm text-body dark:text-offwhite">
							{step.body}
						</p>
					{/if}
					{#if step.links.length}
						<p class="mt-1 space-x-3 text-sm">
							{#each step.links as link (link.target)}
								<a
									href={link.href}
									target={link.external ? '_blank' : undefined}
									rel={link.external ? 'noopener noreferrer' : undefined}
									class="font-semibold text-link hover:text-hover"
									onclick={track(link.target)}
								>
									{link.label}
								</a>
							{/each}
						</p>
					{/if}
				</div>
			</li>
		{/each}
	</ol>

	<div class="mt-12 text-center">
		<a
			href="/countries"
			class="rounded-full bg-link px-7 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-hover"
			onclick={track('cta-countries')}
		>
			{$_('joinUs.cta')}
		</a>
	</div>

	<p class="mt-12 text-center text-sm text-body dark:text-offwhite">
		{$_('joinUs.credit')}
	</p>
</section>
