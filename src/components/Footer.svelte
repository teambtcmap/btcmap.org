<script>
	export let justify;
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';
</script>

<footer class="w-full pb-5 flex justify-{justify} space-x-5">
	<SocialLink url={$socials.twitter} social="twitter" />
	<SocialLink url={$socials.discord} social="discord" />
	<SocialLink url={$socials.github} social="github" />
</footer>
