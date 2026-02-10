<script lang="ts">
	import type { MobileNavIconName } from '$lib/icons/types';
	import type { DropdownLink } from '$lib/types';
	import IconMobileNav from '$lib/icons/IconMobileNav.svelte';
	import NavDropdownDesktop from '$components/layout/NavDropdownDesktop.svelte';
	import NavDropdownMobile from '$components/layout/NavDropdownMobile.svelte';
	import ThemeToggle from '$components/ThemeToggle.svelte';
	import { afterNavigate } from '$app/navigation';
	import { _ } from 'svelte-i18n';

	$: navLinks = [
		{ title: $_('nav.maps'), url: '', icon: 'map' as MobileNavIconName },
		{ title: $_('nav.apps'), url: '/apps', icon: 'apps' as MobileNavIconName },
		{ title: $_('nav.stats'), url: '', icon: 'stats' as MobileNavIconName },
		{ title: $_('nav.areas'), url: '', icon: 'areas' as MobileNavIconName },
		{ title: $_('nav.maintain'), url: '', icon: 'contribute' as MobileNavIconName },
		{
			title: $_('nav.wiki'),
			url: 'https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki',
			icon: 'wiki' as MobileNavIconName
		},
		{ title: $_('nav.blog'), url: 'https://blog.btcmap.org', icon: 'dash' as MobileNavIconName },
		{ title: $_('nav.supportUs'), url: '/support-us', icon: 'support' as MobileNavIconName }
	];

	$: mapsDropdownLinks = [
		{ title: $_('nav.merchantMap'), url: '/map', icon: 'add' as MobileNavIconName },
		{
			title: $_('nav.communityMap'),
			url: '/communities/map',
			icon: 'communities' as MobileNavIconName
		}
	] satisfies DropdownLink[];

	$: statsDropdownLinks = [
		{ title: $_('nav.dashboard'), url: '/dashboard', icon: 'dash' as MobileNavIconName },
		{
			title: $_('nav.taggerLeaderboard'),
			url: '/leaderboard',
			icon: 'leader' as MobileNavIconName
		},
		{
			title: $_('nav.communityLeaderboard'),
			url: '/communities/leaderboard',
			icon: 'communities' as MobileNavIconName
		},
		{
			title: $_('nav.countryLeaderboard'),
			url: '/countries/leaderboard',
			icon: 'countries' as MobileNavIconName
		}
	] satisfies DropdownLink[];

	$: maintainDropdownLinks = [
		{ title: $_('nav.addLocation'), url: '/add-location', icon: 'add' as MobileNavIconName },
		{
			title: $_('nav.addCommunity'),
			url: '/communities/add',
			icon: 'communities' as MobileNavIconName
		},
		{
			title: $_('nav.becomeTagger'),
			url: '/tagger-onboarding',
			icon: 'leader' as MobileNavIconName
		},
		{ title: $_('nav.openTickets'), url: '/tickets', icon: 'ticket' as MobileNavIconName },
		{ title: $_('nav.taggingActivity'), url: '/activity', icon: 'activity' as MobileNavIconName },
		{ title: $_('nav.taggingIssues'), url: '/tagging-issues', icon: 'issue' as MobileNavIconName }
	] satisfies DropdownLink[];

	$: areasDropdownLinks = [
		{ title: $_('nav.communities'), url: '/communities', icon: 'communities' as MobileNavIconName },
		{ title: $_('nav.countries'), url: '/countries', icon: 'countries' as MobileNavIconName }
	] satisfies DropdownLink[];

	let showMobileMenu = false;

	afterNavigate(() => {
		showMobileMenu = false;
	});
</script>

<!-- desktop header -->
<header class="relative z-30 mx-auto hidden w-[1200px] items-center justify-between py-5 xl:flex">
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a href="/">
		<img src="/images/logo.svg" alt="logo" class="w-16" />
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<nav class="flex flex-wrap space-x-16">
		{#each navLinks as link (link.title)}
			<!-- dropdown menu -->
			{#if link.title === 'Maps'}
				<NavDropdownDesktop title={link.title} links={mapsDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Stats'}
				<NavDropdownDesktop title={link.title} links={statsDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Maintain'}
				<NavDropdownDesktop title={link.title} links={maintainDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Areas'}
				<NavDropdownDesktop title={link.title} links={areasDropdownLinks} />
			{:else}
				<!-- regular links -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={link.url}
					class="text-xl font-semibold text-link transition-colors hover:text-hover dark:text-white dark:hover:text-link"
				>
					{link.title}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		{/each}
	</nav>

	<ThemeToggle />
</header>

<!-- mobile header -->
<header
	class="sticky top-0 z-30 flex w-full items-center justify-between px-4 py-5 xl:hidden {showMobileMenu
		? 'bg-teal dark:bg-dark'
		: 'bg-teal/90 dark:bg-dark/90'}"
>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href="/">
		<img src="/images/logo.svg" alt="logo" class="w-16" />
	</a>

	<div class="space-x-4">
		<ThemeToggle />

		<!-- menu toggle -->
		<button on:click={() => (showMobileMenu = !showMobileMenu)}>
			<IconMobileNav
				w={showMobileMenu ? '28' : '34'}
				h={showMobileMenu ? '27' : '12'}
				class="mx-auto mb-3 text-mobileMenu dark:text-white"
				icon={showMobileMenu ? 'close' : 'bars'}
			/>
			<span class="font-semibold text-mobileMenu uppercase dark:text-white">{$_('nav.menu')}</span>
		</button>
	</div>

	<!-- menu -->
	<nav
		class="hide-scroll absolute top-[122.45px] z-30 {showMobileMenu
			? 'left-0'
			: 'left-[-100%]'} h-[calc(100dvh-122.45px)] w-full space-y-2 overflow-y-auto border-t border-[#BDD2D4] bg-teal p-8 transition-all ease-in-out dark:bg-dark"
	>
		{#each navLinks as link (link.title)}
			<!-- dropdown menu -->
			{#if link.title === 'Maps'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={mapsDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Stats'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={statsDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Areas'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={areasDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Maintain'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={maintainDropdownLinks} />

				<!-- regular links -->
			{:else}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={link.url} class="flex w-full items-center text-xl text-link dark:text-white">
					<span
						class="mr-4 rounded-full bg-mobileButtons p-3 transition-colors active:bg-mobileButtonsActive"
					>
						<IconMobileNav w="24" h="24" icon={link.icon} />
					</span>
					<span>{link.title}</span>
				</a>
			{/if}
		{/each}
	</nav>
</header>
