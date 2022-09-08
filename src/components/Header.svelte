<script>
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';
</script>

<div class="md:flex justify-between items-center w-full py-5">
	<a href="/">
		<img src="/images/logo.svg" alt="logo" class="w-16" />
	</a>
	<div class="mt-5 md:mt-0 md:flex justify-center space-x-5">
		<SocialLink url={$socials.twitter} social="twitter" />
		<SocialLink url={$socials.discord} social="discord" />
		<SocialLink url={$socials.github} social="github" />
	</div>
</div>
