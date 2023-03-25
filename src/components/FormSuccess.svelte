<script>
	export let type;
	export let text;
	export let issue;
	export let link;
	export let buttonWidth = 'w-52';

	import { LottiePlayer } from '@lottiefiles/svelte-lottie-player';
	import { PrimaryButton } from '$comp';
	import { socials } from '$lib/store';
</script>

<div class="mt-10 flex items-center justify-center pb-20 text-center md:pb-32">
	<div>
		<h2 class="gradient mb-5 text-4xl font-semibold">{type} Submitted!</h2>
		<p class="mb-5 w-full text-primary dark:text-white md:w-[500px]">
			{text} If you wish to know the status of your contribution, you can join our
			<a
				href={$socials.discord}
				target="_blank"
				rel="noreferrer"
				class="text-link transition-colors hover:text-hover">Discord</a
			>. You may also monitor the progress on GitHub
			<a
				href="https://github.com/teambtcmap/btcmap-data/issues/{issue}"
				target="_blank"
				rel="noreferrer"
				class="text-link transition-colors hover:text-hover">issue #{issue}</a
			>.
		</p>
		{#if typeof window !== 'undefined'}
			<div class="mx-auto w-full md:w-96">
				<LottiePlayer
					src="/lottie/lightning-bolt.json"
					autoplay={true}
					loop={true}
					controls={false}
					renderer="svg"
					background="transparent"
				/>
			</div>
		{/if}
		<PrimaryButton
			text="Submit another {type.toLowerCase()}"
			{link}
			style="{buttonWidth} py-3 mx-auto mt-10 rounded-xl"
		/>
	</div>
</div>
