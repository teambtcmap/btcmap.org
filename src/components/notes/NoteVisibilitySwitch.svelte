<script lang="ts">
import { _ } from "#lib/i18n/index.js";

// Public/private for a note (#1542), off = private. Public notes are not
// shown to anyone on the web yet; the hint says who can see the note now.
type Props = {
	checked: boolean;
	disabled?: boolean;
	onchange: (checked: boolean) => void;
};

let { checked, disabled = false, onchange }: Props = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-describedby="note-visibility-hint"
	{disabled}
	onclick={() => onchange(!checked)}
	class="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left text-body disabled:opacity-50 dark:text-white"
>
	<span>
		<span class="block text-sm font-semibold text-primary dark:text-white">{$_("notes.public")}</span>
		<span id="note-visibility-hint" class="block text-sm text-body dark:text-white/60">
			{checked ? $_("notes.publicOnHint") : $_("notes.publicOffHint")}
		</span>
	</span>
	<span
		class="relative inline-block h-5 w-9 flex-none rounded-full transition-colors {checked
			? 'bg-primary'
			: 'bg-gray-300 dark:bg-white/20'}"
	>
		<span
			class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform {checked
				? 'translate-x-4'
				: 'translate-x-0'}"
		></span>
	</span>
</button>
