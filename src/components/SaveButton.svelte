<script lang="ts">
import Icon from "$components/Icon.svelte";
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";
import { errToast, successToast } from "$lib/utils";

// The numeric ID of the item to save/unsave.
export let id: number;

// Whether this saves a place or an area.
export let type: "place" | "area" = "place";

// Optional className passthrough for layout-specific styling.
let className: string | undefined = undefined;

export { className as class };

let pending = false;

$: savedList =
	type === "place"
		? ($session?.savedPlaces ?? [])
		: ($session?.savedAreas ?? []);
$: saved = savedList.includes(id);

// SvelteKit server routes that proxy to the btcmap API (avoids CORS preflight).
const PROXY_ENDPOINTS = {
	place: "/api/session/saved-places",
	area: "/api/session/saved-areas",
} as const;

async function putSaved(token: string, ids: number[]): Promise<number[]> {
	const res = await api.put<number[]>(PROXY_ENDPOINTS[type], ids, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!Array.isArray(res.data)) {
		throw new Error(
			`PUT ${PROXY_ENDPOINTS[type]} returned an unexpected response`,
		);
	}
	return res.data;
}

async function toggle() {
	if (pending) return;
	pending = true;

	const previousSession = $session;
	const previousSaved =
		type === "place"
			? (previousSession?.savedPlaces ?? [])
			: (previousSession?.savedAreas ?? []);

	try {
		let current = previousSession;
		if (!current) {
			current = await session.signUp();
			successToast($_("save.accountCreated"));
		}

		const nextSaved =
			type === "place"
				? session.toggleSavedPlace(id)
				: session.toggleSavedArea(id);
		if (!nextSaved) throw new Error("toggle returned null (no session)");

		// Write the server's canonical list back to the store so the client
		// stays in sync even if the server deduplicates or rejects IDs.
		const serverList = await putSaved(current.token, nextSaved);
		if (type === "place") {
			session.setSavedPlaces(serverList);
		} else {
			session.setSavedAreas(serverList);
		}
	} catch (err) {
		if (previousSession) {
			if (type === "place") {
				session.setSavedPlaces(previousSaved);
			} else {
				session.setSavedAreas(previousSaved);
			}
		} else {
			// signUp() succeeded but the PUT failed. Don't clear the session —
			// the account and token are valid. Just rollback the saved list to
			// empty so the next click retries with the same account instead of
			// creating another orphan.
			if (type === "place") {
				session.setSavedPlaces([]);
			} else {
				session.setSavedAreas([]);
			}
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
