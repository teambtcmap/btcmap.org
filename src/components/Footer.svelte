<script>
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';

	const links = [
		{ link: '/about-us', name: 'About Us' },
		{ link: '/media', name: 'Media' },
		{ link: '/license', name: 'License' },
		{ link: '/privacy-policy', name: 'Privacy' },
		{ link: 'https://stats.uptimerobot.com/7kgEVtzlV1', name: 'Status' },
		{ link: '/bitcoin.pdf', name: 'White Paper' },
		{ link: '/cypherpunks-manifesto.pdf', name: 'Cypherpunks' }
	];
</script>

<footer class="w-full items-center justify-between space-y-5 pb-5 xl:flex xl:space-y-0">
	<div class="flex flex-wrap justify-center gap-5 xl:block xl:space-x-5">
		<SocialLink url={$socials.twitter} social="twitter" />
		<SocialLink url={$socials.nostr} social="nostr" />
		<SocialLink url={$socials.discord} social="discord" />
		<SocialLink url={$socials.github} social="github" />
		<SocialLink url={$socials.amboss} social="amboss" />
	</div>
	<div class="flex flex-wrap justify-center xl:block">
		{#each links as link}
			<a
				href={link.link}
				class="mx-2.5 {link.name !== 'Cypherpunks'
					? 'mb-2.5 xl:mb-0'
					: ''} text-link transition-colors hover:text-hover text-sm dark:text-white/50 dark:hover:text-link"
				>{link.name}</a
			>
		{/each}
	</div>
</footer>
