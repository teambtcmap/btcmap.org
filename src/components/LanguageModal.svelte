<script lang="ts">
import { fly } from "svelte/transition";
import OutClick from "svelte-outclick";

import CloseButton from "$components/CloseButton.svelte";
import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { _, locale } from "$lib/i18n";

const languages = [
	{ code: "en", name: "English", short: "EN" },
	{ code: "pt-BR", name: "Português (Brasil)", short: "PT" },
	{ code: "bg", name: "Български", short: "BG" },
	{ code: "ru", name: "Русский", short: "RU" },
];

let show = false;

function switchLanguage(newLocale: string) {
	trackEvent("language_switch", { language: newLocale });
	locale.set(newLocale);
	if (typeof window !== "undefined") {
		localStorage.setItem("language", newLocale);
	}
	show = false;
}

function handleOutClick() {
	show = false;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape" && show) {
		show = false;
	}
}
</script>

<svelte:window on:keydown={handleKeydown} />

<button
	type="button"
	on:click={() => (show = true)}
	aria-label={$_("footer.language")}
	aria-expanded={show}
	aria-haspopup="dialog"
	class="flex items-center text-sm text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link"
>
	<span class="font-bold">{$_("footer.language")}</span>
	<Icon
		type="material"
		icon="translate"
		w="16"
		h="16"
		class="ml-1 inline-block align-text-bottom text-link dark:text-white/50"
	/>
</button>

{#if show}
	<OutClick on:outclick={handleOutClick}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			role="dialog"
			aria-modal="true"
			aria-labelledby="language-modal-title"
			class="z-[2000] flex flex-col overflow-auto border border-gray-300 bg-white p-6 shadow-2xl fixed inset-0 w-full h-full dark:border-white/95 dark:bg-dark md:inset-auto md:top-1/2 md:left-1/2 md:w-80 md:max-h-[90vh] md:h-auto md:rounded-xl md:translate-x-[-50%] md:translate-y-[-50%]"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 id="language-modal-title" class="text-lg font-semibold text-primary dark:text-white">
					{$_("footer.selectLanguage")}
				</h2>
				<CloseButton on:click={() => (show = false)} />
			</div>

			<div class="space-y-2">
				{#each languages as language (language.code)}
					<button
						type="button"
						on:click={() => switchLanguage(language.code)}
						disabled={$locale === language.code}
						class="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors
						{$locale === language.code
							? 'bg-primary/10 font-semibold text-primary dark:bg-white/10 dark:text-white'
							: 'hover:bg-gray-100 text-body dark:hover:bg-white/5 dark:text-white'}"
					>
						<span>{language.name}</span>
						<span
							class="text-sm {$locale === language.code
								? 'text-primary dark:text-white'
								: 'text-gray-500 dark:text-white/50'}"
						>
							{language.short}
						</span>
					</button>
				{/each}
			</div>
		</div>
	</OutClick>
{/if}
