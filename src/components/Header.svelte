<script>
	import { NavDropdownDesktop, NavDropdownMobile, Icon } from '$comp';

	const navLinks = [
		{ title: 'Map', url: '/map', icon: 'map' },
		{ title: 'Apps', url: '/apps', icon: 'apps' },
		{ title: 'Contribute', url: '', icon: 'contribute' },
		{ title: 'Stats', url: '', icon: 'stats' },
		{ title: 'Communities', url: '', icon: 'communities' },
		{
			title: 'Wiki',
			url: '',
			icon: 'wiki'
		},
		{ title: 'Support Us', url: '/support-us', icon: 'support' }
	];

	const contributeDropdownLinks = [
		{ title: 'Add Location', url: '/add-location', icon: 'add' },
		{ title: 'Verify Location', url: '/verify-location', icon: 'verify' }
	];

	const statsDropdownLinks = [
		{ title: 'Dashboard', url: '/dashboard', icon: 'dash' },
		{ title: 'Activity', url: '/activity', icon: 'activity' },
		{ title: 'Leaderboard', url: '/leaderboard', icon: 'leader' }
	];

	const communitiesDropdownLinks = [
		{ title: 'Directory', url: '/communities', icon: 'directory' },
		{ title: 'Leaderboard', url: '/communities/leaderboard', icon: 'leader' }
	];

	const wikiDropdownLinks = [
		{
			title: 'General',
			url: 'https://github.com/teambtcmap/btcmap-data/wiki',
			icon: 'general',
			external: true
		},
		{
			title: 'API',
			url: 'https://github.com/teambtcmap/btcmap-api/wiki',
			icon: 'api',
			external: true
		}
	];

	let showMobileMenu = false;
</script>

<!-- desktop header -->
<header
	class="z-30 w-10/12 xl:w-[1200px] mx-auto relative hidden lg:flex justify-between items-center w-full py-5"
>
	<a href="/">
		<img src="/images/logo.svg" alt="logo" class="w-16" />
	</a>

	<nav class="flex flex-wrap lg:space-x-7 xl:space-x-16">
		{#each navLinks as link}
			<!-- dropdown menu -->
			{#if link.title === 'Contribute'}
				<NavDropdownDesktop
					title={link.title}
					links={contributeDropdownLinks}
					top="add"
					bottom="verify"
				/>

				<!-- dropdown menu -->
			{:else if link.title === 'Stats'}
				<NavDropdownDesktop
					title={link.title}
					links={statsDropdownLinks}
					top="dash"
					bottom="leader"
				/>

				<!-- dropdown menu -->
			{:else if link.title === 'Communities'}
				<NavDropdownDesktop
					title={link.title}
					links={communitiesDropdownLinks}
					top="directory"
					bottom="leader"
				/>

				<!-- dropdown menu -->
			{:else if link.title === 'Wiki'}
				<NavDropdownDesktop
					title={link.title}
					links={wikiDropdownLinks}
					top="general"
					bottom="api"
				/>
			{:else}
				<!-- regular links -->
				<a
					href={link.url}
					class="text-link hover:text-hover text-xl font-semibold transition-colors"
					>{link.title}
				</a>
			{/if}
		{/each}
	</nav>
</header>

<!-- mobile header -->
<header
	class="px-4 sticky top-0 z-30 flex lg:hidden justify-between items-center w-full py-5 {showMobileMenu
		? 'bg-teal'
		: 'bg-teal/90'}"
>
	<a href="/">
		<img src="/images/logo.svg" alt="logo" class="w-16" />
	</a>

	<!-- menu toggle -->
	<button on:click={() => (showMobileMenu = !showMobileMenu)}>
		<Icon
			w={showMobileMenu ? '28' : '34'}
			h={showMobileMenu ? '27' : '12'}
			style="mx-auto mb-3"
			icon={showMobileMenu ? 'close' : 'bars'}
			type="mobile-nav"
		/>
		<span class="uppercase text-mobileMenu font-semibold">Menu</span>
	</button>

	<!-- menu -->
	<nav
		class="z-30 absolute top-[122.45px] {showMobileMenu
			? 'left-0'
			: 'left-[-100%]'} transition-all ease-in-out border-t border-[#BDD2D4] w-full h-[100vh] space-y-2 pt-8 px-8 bg-teal"
	>
		{#each navLinks as link}
			<!-- dropdown menu -->
			{#if link.title === 'Contribute'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={contributeDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Stats'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={statsDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Communities'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={communitiesDropdownLinks} />

				<!-- dropdown menu -->
			{:else if link.title === 'Wiki'}
				<NavDropdownMobile title={link.title} icon={link.icon} links={wikiDropdownLinks} />

				<!-- regular links -->
			{:else}
				<a href={link.url} class="w-full text-link text-xl flex items-center">
					<span
						class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3 transition-colors"
					>
						<Icon w="24" h="24" icon={link.icon} type="mobile-nav" />
					</span>
					<span>{link.title}</span>
				</a>
			{/if}
		{/each}
	</nav>
</header>
