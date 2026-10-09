<script lang="ts">
import { _ } from "#lib/i18n/index.js";

// Cancel · Delete pair for a photo's delete confirm step, shared by the
// viewer's ⋯ menu and My photos; the parent lays out the row
type Props = {
	deleting: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	size?: "sm" | "xs";
};

let { deleting, onCancel, onConfirm, size = "sm" }: Props = $props();

const textSize = $derived(size === "sm" ? "text-sm" : "text-xs");
</script>

<button
	type="button"
	onclick={onCancel}
	class="rounded-lg px-3 py-1.5 font-semibold text-primary hover:bg-gray-100 dark:text-white dark:hover:bg-white/10 {textSize}"
>
	{$_('forms.cancel')}
</button>
<button
	type="button"
	onclick={onConfirm}
	disabled={deleting}
	class="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60 {textSize}"
>
	{$_('placePhotos.deleteConfirmAction')}
</button>
