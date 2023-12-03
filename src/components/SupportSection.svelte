<script lang="ts">
	export let title: 'Company' | 'Community';
	export let supporters: { url: string; logoDark?: string; logo: string; title: string }[];
	export let placeholders: number;

	import { theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';
</script>

<div>
	<h3 class="mb-4 text-xl font-semibold text-body dark:text-white">{title}</h3>
	<div class="mx-auto w-full grid-cols-3 gap-10 space-y-10 lg:grid lg:w-[830px] lg:space-y-0">
		{#each supporters as supporter}
			<a
				href={supporter.url}
				target="_blank"
				rel="noreferrer"
				class="mx-auto block w-full self-center md:w-[250px]"
			>
				{#if typeof window !== 'undefined'}
					<img
						src="/images/supporters/{supporter.logoDark
							? detectTheme() === 'dark' || $theme === 'dark'
								? supporter.logoDark
								: supporter.logo
							: supporter.logo}"
						alt={supporter.title}
						class="mx-auto w-[250px]"
					/>
				{/if}
			</a>
		{/each}
		<!-- supporter placeholders -->
		<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
		{#each Array(placeholders) as placeholder}
			<div
				class="mx-auto flex h-[90px] w-full items-center justify-center self-center rounded-xl bg-supporter/50 drop-shadow-xl md:w-[250px]"
			>
				<a href="mailto:hello@btcmap.org" class="uppercase text-white">Apply here</a>
			</div>
		{/each}
	</div>
</div>
