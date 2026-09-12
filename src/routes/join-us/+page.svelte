<script lang="ts">
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import { trackEvent } from "$lib/analytics";
import { theme } from "$lib/theme";

// The native onboarding guide (#1376): the content of Igor's
// join.btcmap.org proof of concept, rebuilt in the app's own design and
// wired to the live pages it describes. It replaces the old
// /tagger-onboarding application form — the guide IS the onboarding;
// the form was a gate. English-only for now, like the page it replaces.
// One analytics event with a target property keeps the funnel readable
// without five near-identical names.
const track = (target: string) => () =>
	trackEvent("join_us_link_click", { target });

type StepLink = {
	href: string;
	label: string;
	target: string;
	external?: boolean;
};
type Step = { title: string; body?: string; links: StepLink[] };

const steps: Step[] = [
	{
		title: "Find your community or country",
		links: [
			{ href: "/countries", label: "Browse countries", target: "countries" },
			{
				href: "/communities",
				label: "Browse communities",
				target: "communities",
			},
		],
	},
	{
		title: "Open the Maintenance tab",
		body: "Every country and community page has one — it lists the merchants with data issues that need attention.",
		links: [
			{
				href: "/country/th/maintain",
				label: "Example: Thailand's maintenance list",
				target: "maintain-example",
			},
		],
	},
	{
		title: "Pick local issues you can fix",
		body: "Scan the list. Outdated opening hours, missing coordinates, wrong names — small fixes make a big difference.",
		links: [],
	},
	{
		title: "Fix them on OpenStreetMap",
		body: "Create a free OpenStreetMap account and edit the map directly. Changes usually appear on BTC Map within an hour, and the help button on each issue shows issue-specific guidance.",
		links: [
			{
				href: "https://www.openstreetmap.org/user/new",
				label: "Create an OpenStreetMap account",
				target: "osm-signup",
				external: true,
			},
		],
	},
	{
		title: "Need help? Join the chat",
		body: "We're a friendly, global crew — there's always someone happy to help.",
		links: [
			{
				href: "https://matrix.to/#/#btcmap-taggers:matrix.org",
				label: "#btcmap-taggers:matrix.org",
				target: "matrix",
				external: true,
			},
		],
	},
];
</script>

<svelte:head>
	<title>BTC Map - Join Us</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="og:title" content="BTC Map - Join Us" />
	<meta name="twitter:title" content="BTC Map - Join Us" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

{#if typeof window !== 'undefined'}
	<h1
		class="{$theme === 'dark'
			? 'text-white'
			: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
	>
		Help us map Bitcoin acceptance worldwide.
	</h1>
{:else}
	<HeaderPlaceholder />
{/if}

<section id="join-us" class="mx-auto mt-10 w-full pb-20 md:w-[600px] md:pb-32">
	<p class="mb-6 text-center text-primary dark:text-white">
		A short, five-step guide to start contributing to BTC Map in your
		community — our biggest challenge is keeping the data fresh, and every
		fix counts.
	</p>

	<div
		class="mb-10 rounded-2xl border-2 border-input p-4 text-sm text-body dark:text-offwhite"
	>
		<span class="font-semibold">Open data.</span>
		We don't own the data — it's completely open and lives on
		<a
			href="https://www.openstreetmap.org/"
			target="_blank"
			rel="noopener noreferrer"
			class="font-semibold text-link hover:text-hover"
			onclick={track('osm-about')}
		>
			OpenStreetMap
		</a>. Anyone with an account can edit it; BTC Map is a friendly viewer on
		top.
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
			Find your country
		</a>
	</div>

	<p class="mt-12 text-center text-sm text-body dark:text-offwhite">
		Made by volunteers. Map data © OpenStreetMap contributors.
	</p>
</section>
