<script>
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';
</script>

<footer class="w-full pb-5 md:flex justify-between items-center space-y-5 md:space-y-0">
	<div class="space-x-5 flex md:block justify-center">
		<SocialLink url={$socials.twitter} social="twitter" />
		<SocialLink url={$socials.discord} social="discord" />
		<SocialLink url={$socials.github} social="github" />
	</div>
	<div class="flex flex-wrap md:block justify-center">
		<a
			href="/bitcoin.pdf"
			class="mx-2.5 mb-2.5 md:mb-0 text-link hover:text-hover transition-colors">White paper</a
		>
		<a href="/license" class="mx-2.5 mb-2.5 md:mb-0 text-link hover:text-hover transition-colors"
			>License</a
		>
		<a href="/privacy-policy" class="mx-2.5 text-link hover:text-hover transition-colors">Privacy</a
		>
	</div>
</footer>
