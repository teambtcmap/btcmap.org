<script>
	const navLinks = [
		{ title: 'Map', url: '/map' },
		{ title: 'Apps', url: '/apps' },
		{ title: 'Add Location', url: '/add-location' },
		{ title: 'Wiki', url: 'https://github.com/teambtcmap/btcmap-data/wiki', external: true },
		{ title: 'Support Us', url: '/support-us' }
	];
</script>

<header>
	<div class="md:flex justify-between items-center w-full py-5">
		<a href="/">
			<img src="/images/logo.svg" alt="logo" class="w-16" />
		</a>
		<nav class="flex flex-wrap md:space-x-8 lg:space-x-16">
			{#each navLinks as link}
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
			{/each}
		</nav>
	</div>
</header>
