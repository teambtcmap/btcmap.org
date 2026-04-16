<script lang="ts">
import SaveAuthPrompt from "$components/auth/SaveAuthPrompt.svelte";
import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { SavedItemType } from "$lib/savedItems";
import {
	getSavedList,
	putSavedList,
	setSavedList,
	toggleSavedLocal,
} from "$lib/savedItems";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

// The numeric ID of the item to save/unsave.
export let id: number;

// Whether this saves a place or an area.
export let type: SavedItemType = "place";

// Optional className passthrough for layout-specific styling.
let className: string | undefined = undefined;

export { className as class };

let pending = false;
let showPrompt = false;

$: savedList = getSavedList($session, type);
$: saved = savedList.includes(id);

async function toggle() {
	if (pending) return;

	// No session — open the auth prompt instead of silently creating an account.
	// The modal handles signup/login and performs the save itself.
	if (!$session) {
		showPrompt = true;
		trackEvent("save_prompt_shown", { type });
		return;
	}

	pending = true;
	const previousSaved = [...savedList];
	try {
		const nextSaved = toggleSavedLocal(type, id);
		if (!nextSaved) throw new Error("toggle returned null (no session)");

		// Write the server's canonical list back to the store so the client
		// stays in sync even if the server deduplicates or rejects IDs.
		const serverList = await putSavedList(type, $session.token, nextSaved);
		setSavedList(type, serverList);
		trackEvent("save_item_toggle", {
			saved: serverList.includes(id),
			type,
			source: "save_button",
		});
	} catch (err) {
		setSavedList(type, previousSaved);
		errToast($_(`merchant.saveFailed`));
		console.error("SaveButton.toggle failed", err);
	} finally {
		pending = false;
	}
}
</script>

<button
	type="button"
	class="{saved
		? 'border border-link text-link hover:bg-link/10 dark:border-link dark:text-link'
		: 'bg-link text-white hover:bg-hover'} mx-auto flex w-28 items-center justify-center rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition-colors {pending ? 'opacity-50' : ''} {className ??
		''}"
	on:click={toggle}
	aria-pressed={saved}
	aria-label={saved ? $_(`merchant.saved`) : $_(`merchant.save`)}
>
	<Icon
		type="material"
		icon={saved ? 'bookmark_filled' : 'bookmark'}
		w="16"
		h="16"
		class="mr-1"
	/>
	<span class="grid">
		<span
			class="col-start-1 row-start-1 transition-opacity {saved
				? 'opacity-0'
				: 'opacity-100'}"
			aria-hidden={saved}>{$_(`merchant.save`)}</span
		>
		<span
			class="col-start-1 row-start-1 transition-opacity {saved
				? 'opacity-100'
				: 'opacity-0'}"
			aria-hidden={!saved}>{$_(`merchant.saved`)}</span
		>
	</span>
</button>

<SaveAuthPrompt bind:open={showPrompt} {id} {type} />
