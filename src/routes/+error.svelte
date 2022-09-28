<script>
	import { page } from '$app/stores';
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';
</script>

<div class="bg-teal">
	<div class="w-10/12 xl:w-[1200px] mx-auto relative">
		<header>
			<a href="/">
				<img src="/images/logo.svg" alt="logo" class="w-32 py-5 mx-auto" />
			</a>
		</header>

		<div class="text-center space-y-10 py-10">
			<a href="/" class="text-link hover:text-hover font-semibold text-xl"
				><i class="fa-solid fa-house mr-2" /> Home</a
			>
			<h1 class="text-4xl md:text-5xl">{$page.status}: {$page.error.message}</h1>
			<h2 class="text-xl text-primary font-semibold">Please try again or contact BTC Map.</h2>
		</div>

		<footer class="space-x-5 pb-5 flex justify-center">
			<SocialLink url={$socials.twitter} social="twitter" />
			<SocialLink url={$socials.discord} social="discord" />
			<SocialLink url={$socials.github} social="github" />
		</footer>
	</div>
</div>
