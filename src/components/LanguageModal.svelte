<script lang="ts">
import Modal from "$components/Modal.svelte";
import { trackEvent } from "$lib/analytics";
import { _, locale } from "$lib/i18n";

const languages = [
	{ code: "en", name: "English", short: "EN" },
	{ code: "de", name: "Deutsch", short: "DE" },
	{ code: "pt-BR", name: "Português (Brasil)", short: "PT" },
	{ code: "bg", name: "Български", short: "BG" },
	{ code: "ru", name: "Русский", short: "RU" },
	{ code: "nl", name: "Nederlands", short: "NL" },
	{ code: "fr", name: "Français", short: "FR" },
	{ code: "es", name: "Español", short: "ES" },
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
</script>

<button
	type="button"
	on:click={() => (show = !show)}
	aria-expanded={show}
	aria-haspopup="dialog"
	class="flex items-center text-sm text-link transition-colors hover:text-hover dark:text-white/50 dark:hover:text-link"
>
	<span>{$_("footer.language")}</span>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="currentColor"
		class="ml-1 inline-block align-text-bottom text-link dark:text-white/50"
		aria-hidden="true"
	>
		<path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
	</svg>
</button>

<Modal bind:open={show} title={$_("footer.selectLanguage")} titleId="language-modal-title">
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
</Modal>
