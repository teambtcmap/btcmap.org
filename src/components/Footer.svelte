<script>
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';

	const links = [
		{ link: '/about-us', name: 'About Us' },
		{ link: '/media', name: 'Media' },
		{ link: '/bitcoin.pdf', name: 'White Paper' },
		{ link: '/license', name: 'License' },
		{ link: '/privacy-policy', name: 'Privacy' }
	];
</script>

<footer class="w-full items-center justify-between space-y-5 pb-5 md:flex md:space-y-0">
	<div class="flex justify-center space-x-5 md:block">
		<SocialLink url={$socials.twitter} social="twitter" />
		<SocialLink url={$socials.discord} social="discord" />
		<SocialLink url={$socials.github} social="github" />
	</div>
	<div class="flex flex-wrap justify-center md:block">
		{#each links as link}
			<a
				href={link.link}
				class="mx-2.5 {link.name !== 'Privacy'
					? 'mb-2.5 md:mb-0'
					: ''} text-link transition-colors hover:text-hover">{link.name}</a
			>
		{/each}
	</div>
</footer>
