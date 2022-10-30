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

<div class="flex justify-center items-center text-center pb-20 md:pb-32 mt-10">
	<div>
		<h2 class="gradient text-4xl font-semibold mb-5">{type} Submitted!</h2>
		<p class="text-primary w-full md:w-[500px] mb-5">
			{text} If you wish to know the status of your contribution, join our
			<a href={$socials.discord} target="_blank" rel="noreferrer" class="text-link hover:text-hover"
				>Discord</a
			>. You can also monitor the progress on GitHub
			<a
				href="https://github.com/teambtcmap/btcmap-data/issues/{issue}"
				target="_blank"
				rel="noreferrer"
				class="text-link hover:text-hover">issue #{issue}</a
			>.
		</p>
		{#if typeof window !== 'undefined'}
			<div class="w-full md:w-96 mx-auto">
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
