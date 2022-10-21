<script>
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';
</script>

<footer class="w-full pb-5 flex justify-between items-center">
	<div class="space-x-2 md:space-x-5">
		<SocialLink url={$socials.twitter} social="twitter" />
		<SocialLink url={$socials.discord} social="discord" />
		<SocialLink url={$socials.github} social="github" />
	</div>
	<div>
		<a href="/privacy-policy" class="text-link hover:text-hover">Privacy</a>
	</div>
</footer>
