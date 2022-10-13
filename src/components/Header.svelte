<script>
	import { OutClick } from '$comp';

	const navLinks = [
		{ title: 'Map', url: '/map', icon: 'map' },
		{ title: 'Apps', url: '/apps', icon: 'apps' },
		{ title: 'Add Location', url: '/add-location', icon: 'add' },
		{ title: 'Stats', url: '', icon: 'stats' },
		{
			title: 'Wiki',
			url: 'https://github.com/teambtcmap/btcmap-data/wiki',
			external: true,
			icon: 'wiki'
		},
		{ title: 'Support Us', url: '/support-us', icon: 'support' }
	];

	const dropdownLinks = [
		{ title: 'Dashboard', url: '/dashboard', icon: 'dash' },
		{ title: 'Leaderboard', url: '/leaderboard', icon: 'leader' }
	];

	let showStats = false;
	let showMobileMenu = false;
	let showStatsMobile = false;
</script>

<!-- desktop header -->
<header
	class="z-30 w-10/12 xl:w-[1200px] mx-auto relative hidden lg:flex justify-between items-center w-full py-5"
>
	<a href="/">
		<img src="/images/logo.svg" alt="logo" class="w-16" />
	</a>

	<nav class="flex flex-wrap lg:space-x-14 xl:space-x-16">
		{#each navLinks as link}
			<!-- regular links -->
			{#if link.title !== 'Stats'}
				<a
					href={link.url}
					target={link.external ? '_blank' : '_self'}
					rel="noreferrer"
					class="mr-4 mt-4 md:mr-0 md:mt-0 text-link hover:text-hover text-xl font-semibold flex items-center"
					>{link.title}
					{#if link.external}
						<i class="ml-1 w-4 h-4 fa-solid fa-arrow-up-right-from-square" />
					{/if}
				</a>
				<!-- dropdown menu -->
			{:else}
				<div class="relative">
					<button
						id="dropdown-menu"
						on:click={() => (showStats = !showStats)}
						class="mr-4 mt-4 md:mr-0 md:mt-0 text-link hover:text-hover text-xl font-semibold flex items-center"
					>
						{link.title} <i class="ml-1 w-4 h-4 fa-solid fa-chevron-down" />
					</button>
					<!-- dropdown items -->
					{#if showStats}
						<OutClick
							excludeByQuerySelector={['#dropdown-menu']}
							on:outclick={() => (showStats = false)}
						>
							<div class="absolute top-8 right-0 rounded-2xl shadow-lg">
								{#each dropdownLinks as link}
									<a
										href={link.url}
										class="text-center p-4 block bg-link hover:bg-hover text-white text-xl font-semibold {link.icon ===
										'dash'
											? 'rounded-t-2xl'
											: 'rounded-b-2xl'}">{link.title}</a
									>
								{/each}
							</div>
						</OutClick>
					{/if}
				</div>
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
		<img
			src={showMobileMenu ? '/icons/mobile-nav/close.svg' : '/icons/mobile-nav/bars.svg'}
			alt="togglemenu"
			class="mx-auto mb-3"
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
			<!-- regular links -->
			{#if link.title !== 'Stats'}
				<a
					href={link.url}
					target={link.external ? '_blank' : '_self'}
					rel="noreferrer"
					class="w-full text-link text-xl flex items-center"
				>
					<img
						src="/icons/mobile-nav/{link.icon}.svg"
						alt={link.icon}
						class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3"
					/>
					<span>{link.title}</span>
					{#if link.external}
						<i class="ml-1 w-4 h-4 fa-solid fa-arrow-up-right-from-square" />
					{/if}
				</a>
				<!-- dropdown menu -->
			{:else}
				<button
					on:click={() => (showStatsMobile = !showStatsMobile)}
					class="w-full {showStatsMobile
						? 'text-[#144046]'
						: 'text-link'} text-xl flex items-center"
				>
					<img
						src={showStatsMobile
							? '/icons/mobile-nav/stats-highlight.svg'
							: '/icons/mobile-nav/stats.svg'}
						alt={link.icon}
						class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3"
					/>
					<span>{link.title}</span>
				</button>
				<!-- dropdown items -->
				{#if showStatsMobile}
					<div class="ml-7 space-y-2">
						{#each dropdownLinks as link}
							<a href={link.url} class="w-full text-link text-xl flex items-center">
								<img
									src="/icons/mobile-nav/{link.icon}.svg"
									alt={link.icon}
									class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3"
								/>
								<span>{link.title}</span>
							</a>
						{/each}
					</div>
				{/if}
			{/if}
		{/each}
	</nav>
</header>
