<script lang="ts">
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";

export let supporters: {
	url: string;
	logoDark?: string;
	logo: string;
	title: string;
}[];
export let placeholders: number;

$: t = $_;
</script>

<div class="mt-4">
	<div class="mx-auto w-full grid-cols-3 gap-10 space-y-10 lg:grid lg:w-[830px] lg:space-y-0">
		{#each supporters as supporter (supporter.url)}

			<a
				href={supporter.url}
				target="_blank"
				rel="noreferrer"
				class="mx-auto block w-full self-center md:w-[250px]"
			>

				{#if typeof window !== 'undefined'}
					<img
						src="/images/supporters/{supporter.logoDark
							? $theme === 'dark'
								? supporter.logoDark
								: supporter.logo
							: supporter.logo}"
						alt={supporter.title}
						class="mx-auto w-[250px]"
					/>
				{/if}
			</a>
		{/each}
		{#each Array(placeholders) as _, index (index)}
			<div
				class="mx-auto flex h-[90px] w-full items-center justify-center self-center rounded-xl bg-supporter/50 drop-shadow-xl md:w-[250px]"
			>
				<a href="mailto:hello@btcmap.org" class="text-white uppercase">{t("supportUs.applyHere")}</a>
			</div>
		{/each}
	</div>
</div>
