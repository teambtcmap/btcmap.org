<script lang="ts">

	import { HeaderPlaceholder, PrimaryButton } from '$lib/comp';
	import { socials, theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';
	interface Props {
		type: string;
		text: string;
		issue: number;
		link: string;
		buttonWidth?: string;
	}

	let {
		type,
		text,
		issue,
		link,
		buttonWidth = 'w-52'
	}: Props = $props();
</script>

<div class="mt-10 flex items-center justify-center pb-20 text-center md:pb-32">
	<div>
		{#if typeof window !== 'undefined'}
			<h2
				class="{detectTheme() === 'dark' || $theme === 'dark'
					? 'text-white'
					: 'gradient'} mb-5 text-4xl font-semibold"
			>
				{type} Submitted!
			</h2>
		{:else}
			<HeaderPlaceholder />
		{/if}
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

		<PrimaryButton
			text="Submit another {type.toLowerCase()}"
			{link}
			style="{buttonWidth} py-3 mx-auto mt-10 rounded-xl"
		/>
	</div>
</div>
