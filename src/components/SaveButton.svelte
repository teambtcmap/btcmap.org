<script lang="ts">
import { _ } from "svelte-i18n";

import Icon from "$components/Icon.svelte";
import api from "$lib/axios";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

// The numeric place (element) ID to save/unsave.
export let placeId: number;

// Optional className passthrough for layout-specific styling.
let className: string | undefined = undefined;

export { className as class };

let pending = false;

// Whether this place is currently in the user's saved_places list.
$: saved = $session?.savedPlaces.includes(placeId) ?? false;

async function putSavedPlaces(token: string, ids: number[]): Promise<void> {
	const res = await api.put<number[]>(
		"https://api.btcmap.org/v4/places/saved",
		ids,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (!Array.isArray(res.data)) {
		throw new Error("PUT /v4/places/saved returned an unexpected response");
	}
}

async function toggle() {
	if (pending) return;
	pending = true;

	// Snapshot the current state so we can roll back on error.
	const previousSession = $session;
	const previousSaved = previousSession?.savedPlaces ?? [];

	try {
		// Ensure we have a session. signUp() is memoized so double-clicks are safe.
		let current = previousSession;
		if (!current) {
			current = await session.signUp();
		}

		// Compute the next list and optimistically update the UI.
		const nextSaved = saved
			? current.savedPlaces.filter((id) => id !== placeId)
			: [...current.savedPlaces, placeId];
		session.setSavedPlaces(nextSaved);

		// Persist to the server. On failure we roll back below.
		await putSavedPlaces(current.token, nextSaved);
	} catch (err) {
		// Rollback: restore the previous saved list if we had a session, or
		// clear any partial state we wrote. Don't touch the token itself —
		// if signUp() failed there's no session to restore.
		if (previousSession) {
			session.setSavedPlaces(previousSaved);
		}
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
		: 'bg-link text-white hover:bg-hover'} mx-auto flex w-28 items-center justify-center rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition-colors disabled:opacity-50 {className ??
		''}"
	on:click={toggle}
	disabled={pending}
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
	<!-- Render both labels stacked and toggle visibility so the button width
	     stays constant across the save/saved transition. -->
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
