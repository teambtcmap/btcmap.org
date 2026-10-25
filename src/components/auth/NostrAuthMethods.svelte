<script lang="ts">
import type { EventTemplate } from "nostr-tools/pure";
import { onDestroy, onMount, tick } from "svelte";

import type { NostrSignMethod } from "#lib/analytics.js";
import { fieldBorderClasses } from "#lib/fieldStyles.js";
import { _ } from "#lib/i18n/index.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import { getNostrExtension } from "#lib/nostr.js";
import type {
	NostrForm,
	NostrMethod,
	PanelState,
} from "#lib/nostrMethodLayout.js";
import {
	methodBlocked,
	methodOpen,
	nostrMethodLayout,
	pairingClick,
	rowClick,
} from "#lib/nostrMethodLayout.js";
import { fetchProfile } from "#lib/nostrProfile.js";
import { shortNpub } from "#lib/nostrSigner.js";
import type { PairMode } from "#lib/signerRun.svelte.js";
import { createSignerRun } from "#lib/signerRun.svelte.js";
import { errToast } from "#lib/utils.js";
import Icon from "$components/Icon.svelte";
import TextLink from "$components/TextLink.svelte";

// Every way to sign a NIP-98 event with a user's key, as one panel: browser
// extension, NostrConnect (QR / hand-off / copy), bunker URI, secret key, and
// a saved signer pairing. Logging in and linking a key to an account sign the
// same kind of event for different URLs, so the transports live here once and
// the caller supplies the template and what to do with the signature. The run
// itself (cancel, stale results, the pairing, toasts, events) is
// signerRun.svelte.ts; this renders it and owns what is on screen.
//
// Laid out for the device (#1568): the likely method as the one primary
// button, the rest as a list of rows that expand in place, and the technical
// or risky ones (bunker, nsec) behind "More options".

type Mode = "login" | "link";

type Props = {
	// Which surface this panel is on: picks the copy and the funnel's events.
	mode: Mode;
	// The NIP-98 template to sign, built at signing time (the API's
	// created_at window is +/-60s and connecting a signer can take minutes).
	template: () => EventTemplate;
	// Submit the signed event (exchange it for a session, link the key).
	// Resolves false when the caller already told the user why it was
	// refused — no success event, no pairing saved.
	submit: (event: SignedAuthEvent, method: NostrSignMethod) => Promise<boolean>;
	// Called before a transport starts signing: a caller that binds the
	// signature to something (the account being linked) snapshots it there,
	// before any await can outlive it.
	onStart?: () => void;
	// Drop the row hints where height is scarce (the add-location drawer)
	dense?: boolean;
};

let { mode, template, submit, onStart, dense = false }: Props = $props();
const uid = $props.id();

// Copy per surface: the transports are the same, the sentence under the
// button is not ("Log in with…" vs "Link with…"). The events are
// signerRun.svelte.ts's.
const LABELS = {
	login: {
		extensionAction: "login.optionExtensionAction",
		bunkerAction: "login.bunkerConnect",
		nsecAction: "login.nsecSubmit",
		nsecHint: "login.nsecWarning",
		savedAction: "login.continueAs",
	},
	link: {
		extensionAction: "account.nostr.linkExtension",
		bunkerAction: "login.bunkerConnect",
		nsecAction: "account.nostr.linkNsec",
		nsecHint: "account.nostr.nsecWarning",
		savedAction: "account.nostr.linkSaved",
	},
} as const;

const labels = $derived(LABELS[mode]);

const primaryButton =
	"flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 aria-disabled:opacity-50";
const outlineButton =
	"w-full rounded-lg border border-purple-600 px-4 py-2 font-semibold text-purple-600 transition-colors hover:bg-purple-600/10 disabled:opacity-50 aria-disabled:opacity-50 dark:border-purple-400 dark:text-purple-300 dark:hover:bg-purple-400/10";
// One bordered group per list, rows split by a hairline: one border language
// instead of a card around every transport.
const listClass =
	"divide-y divide-gray-300 overflow-hidden rounded-2xl border border-gray-300 dark:divide-white/20 dark:border-white/20";
const rowClass =
	"grid min-h-14 w-full grid-cols-[2rem_1fr_1rem] items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-purple-600/5 focus-visible:ring-2 focus-visible:ring-link focus-visible:outline-none focus-visible:ring-inset aria-disabled:opacity-50 dark:hover:bg-white/5";
const rowOpen = "bg-purple-600/5 dark:bg-white/5";
const hintClass = "text-xs text-body dark:text-white/70";
const statusClass =
	"flex items-center justify-center gap-2 text-xs text-body dark:text-white/50";

let nsec = $state("");
let nsecInput = $state<HTMLInputElement>();
let bunkerInput = $state<HTMLInputElement>();
// A NIP-07 extension is only detectable in the browser, and it may inject after
// mount (or after the user installs one), so its row is refreshed on mount, on
// window focus and once shortly after mount.
let hasExtension = $state(false);

// "More options" (bunker, nsec), and which of their forms is open: their
// fields only render once their row is picked.
let showMore = $state(false);
let formOpen = $state<NostrForm | null>(null);
// A touch device most likely holds the signer app itself
let isTouch = $state(false);
// kind:0 name for the saved signer, when public relays have one.
let savedSignerName = $state<string | null>(null);
let profileFor: string | null = null;
let bunkerUri = $state("");
let copied = $state(false);
let qrFailed = $state(false);
let qrCanvas = $state<HTMLCanvasElement | null>(null);
let noAppHint = $state(false);
let noAppTimer: ReturnType<typeof setTimeout> | null = null;
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

// The panel's surface (login or link) is fixed for its lifetime, so the run
// reads `mode` once; the callbacks read the live props.
const runner = createSignerRun({
	// svelte-ignore state_referenced_locally
	mode,
	template: () => template(),
	submit: (event, method) => submit(event, method),
	onStart: () => onStart?.(),
	present: (uri, presentation, run) => {
		noAppHint = false;
		// The QR draws itself once its canvas mounts (the $effect below)
		if (presentation === "open") handOff(uri, run);
		else if (presentation === "copy") void copyConnection(uri);
	},
	onCancel: () => {
		if (noAppTimer) {
			clearTimeout(noAppTimer);
			noAppTimer = null;
		}
		if (copiedTimer) {
			clearTimeout(copiedTimer);
			copiedTimer = null;
		}
		copied = false;
		qrFailed = false;
		noAppHint = false;
	},
});

const layout = $derived(
	nostrMethodLayout({
		isTouch,
		hasExtension,
		hasSaved: runner.savedPairing !== null,
	}),
);
const savedName = $derived(
	runner.savedPairing
		? (savedSignerName ??
				shortNpub(runner.savedPairing.npub ?? runner.savedPairing.pubkey))
		: "",
);

function forgetSigner() {
	// Aria-disabled while a run is going: forgetting would cancel it
	if (runner.anyLoading) return;
	runner.forget();
}

function toggleMore() {
	showMore = !showMore;
	runner.trackOptionsToggle(showMore);
	if (!showMore && formOpen) closeForm();
}

function closeForm() {
	if (runner.signerRun === "bunker") runner.cancel();
	formOpen = null;
}

async function openForm(form: NostrForm) {
	if (formOpen === form) {
		closeForm();
		return;
	}
	// One row open at a time. Nothing is running here: a form row is
	// blocked while any transport runs (Cancel first).
	formOpen = form;
	await tick();
	if (form === "nsec") nsecInput?.focus();
	else bunkerInput?.focus();
}

const panelState = $derived<PanelState>({
	signerRun: runner.signerRun,
	pairMode: runner.pairMode,
	formOpen,
	extensionSigning: runner.nostrLoading,
	nsecSigning: runner.nsecLoading,
	uriReady: runner.connectUri !== null,
});
const isOpen = (method: NostrMethod) => methodOpen(method, panelState);
const isBlocked = (method: NostrMethod) => methodBlocked(method, panelState);

// The primary button and the list rows run the same transports. A blocked
// method is aria-disabled, and the click it still takes does nothing.
function activate(method: NostrMethod) {
	if (isBlocked(method)) return;
	switch (method) {
		case "saved":
			void runner.useSavedPairing();
			return;
		case "extension":
			if (formOpen) closeForm();
			void signWithExtension();
			return;
		case "bunker":
		case "nsec":
			void openForm(method);
			return;
		default:
			// The open row isn't blocked, but before the URI exists its
			// pairing has nothing to re-present: not a counted click
			if (pairingClick(panelState) === "ignore") return;
			formOpen = null;
			void runner.startPairing(method);
	}
}

// The primary button re-runs its presentation (another hand-off); a row
// closes the running pairing instead (rowClick).
function toggleRow(method: NostrMethod) {
	if (rowClick(method, panelState) === "close") runner.cancel();
	else activate(method);
}

// The extension button is live only when a NIP-07 provider is actually there,
// so the user isn't offered a button whose only outcome is an error toast.
function refreshExtension() {
	hasExtension = getNostrExtension() !== null;
}

async function signWithExtension() {
	if (!(await runner.signWithExtension())) refreshExtension();
}

async function connectWithBunker(event: SubmitEvent) {
	event.preventDefault();
	if (await runner.connectBunker(bunkerUri)) bunkerUri = "";
}

async function signWithNsec(event: SubmitEvent) {
	event.preventDefault();
	const ok = await runner.signWithNsec(nsec, () => {
		nsec = "";
	});
	// The key was cleared before the submit, so the empty field disables the
	// focused submit (#1548): retrying starts there anyway.
	if (!ok) nsecInput?.focus();
}

// A scheme with no registered handler is ignored silently — the page just
// stays put — so point at the QR/copy routes if nothing opens.
function handOff(uri: string, run: number) {
	window.location.href = uri;
	if (noAppTimer) clearTimeout(noAppTimer);
	noAppTimer = setTimeout(() => {
		if (runner.isCurrent(run)) noAppHint = true;
	}, 1800);
}

async function renderQr(canvas: HTMLCanvasElement, uri: string) {
	try {
		const QRCode = await import("qrcode");
		await QRCode.default.toCanvas(canvas, uri, { width: 200, margin: 1 });
		qrFailed = false;
	} catch (err) {
		qrFailed = true;
		console.error("Could not render the NostrConnect QR code:", err);
	}
}

async function copyConnection(uri: string) {
	let ok = false;
	try {
		await navigator.clipboard.writeText(uri);
		ok = true;
	} catch {
		// Safari can drop the user activation across an await; a selection copy
		// still works there.
		ok = copyWithSelection(uri);
	}
	if (!ok) {
		// The string is deliberately never shown, so the QR is the fallback.
		errToast($_("login.connectCopyFailed"));
		return;
	}
	copied = true;
	if (copiedTimer) clearTimeout(copiedTimer);
	copiedTimer = setTimeout(() => (copied = false), 2000);
}

function copyWithSelection(uri: string): boolean {
	try {
		const area = document.createElement("textarea");
		area.value = uri;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand("copy");
		area.remove();
		return ok;
	} catch {
		return false;
	}
}

function primaryLabel(method: NostrMethod): string {
	switch (method) {
		case "saved":
			return runner.signerRun === "saved"
				? $_("login.signerWaiting")
				: rowTitle(method);
		case "extension":
			return runner.nostrLoading
				? $_("login.nostrSigning")
				: $_(labels.extensionAction);
		default:
			return rowTitle(method);
	}
}

function rowTitle(method: NostrMethod): string {
	switch (method) {
		case "saved":
			return $_(labels.savedAction, { values: { name: savedName } });
		case "extension":
			return $_("login.optionExtension");
		case "open":
			return $_("login.connectOpen");
		case "qr":
			return $_("login.connectShow");
		case "copy":
			return copied ? $_("login.connectCopied") : $_("login.connectCopy");
		case "bunker":
			return $_("login.optionBunker");
		case "nsec":
			return $_("login.optionNsec");
	}
}

function rowHint(method: NostrMethod): string | null {
	switch (method) {
		case "extension":
			return runner.nostrLoading
				? $_("login.nostrSigning")
				: $_("login.optionExtensionHint");
		case "open":
			return $_("login.connectOpenHint");
		case "qr":
			// On a computer the signer is most likely the phone in a pocket
			return isTouch
				? $_("login.connectShowHint")
				: $_("login.connectShowHintPhone");
		case "copy":
			return $_("login.connectCopyHint");
		case "nsec":
			return $_("login.nsecLeastSafe");
		default:
			return null;
	}
}

onMount(() => {
	runner.restorePairing();
	isTouch = window.matchMedia("(pointer: coarse)").matches;
	refreshExtension();
	// Extensions inject on their own schedule, and a user who installs one has
	// to come back to this tab: re-probe on focus and once shortly after mount.
	window.addEventListener("focus", refreshExtension);
	const lateProbe = setTimeout(refreshExtension, 1_000);
	return () => {
		window.removeEventListener("focus", refreshExtension);
		clearTimeout(lateProbe);
	};
});

// Draw the QR whenever a canvas mounts for it: on the URI's arrival, on a
// switch back to QR, and when a layout change (an extension injecting late)
// moves the QR body from the primary button into a row.
$effect(() => {
	if (qrCanvas && runner.connectUri && runner.pairMode === "qr") {
		void renderQr(qrCanvas, runner.connectUri);
	}
});

// Name the saved signer by its kind:0 profile when one exists, and fall back
// to the shortened npub otherwise. fetchProfile caches per key and resolves to
// null on timeout, so a dead relay just leaves the npub on screen.
$effect(() => {
	const npub = runner.savedPairing?.npub ?? null;
	if (npub === profileFor) return;
	profileFor = npub;
	savedSignerName = null;
	if (!npub) return;
	void fetchProfile(npub).then((profile) => {
		if (profileFor !== npub) return;
		savedSignerName = profile?.displayName ?? profile?.name ?? null;
	});
});

onDestroy(() => {
	runner.cancel();
});
</script>

{#snippet waitingDot()}
	<span
		class="h-2 w-2 shrink-0 rounded-full bg-purple-600 motion-safe:animate-pulse dark:bg-purple-400"
		aria-hidden="true"
	></span>
{/snippet}

{#snippet runFooter(method: NostrMethod)}
	{#if runner.authUrl}
		<TextLink
			link={runner.authUrl}
			external
			style="block w-full truncate text-center text-sm"
			onclick={runner.trackAuthUrlClick}
		>
			{$_("login.signerAuthLink")}
		</TextLink>
	{/if}
	<!-- Cancel sits with the run it stops, not at the end of the panel -->
	<div
		class="flex text-sm font-semibold {method === 'qr' && runner.connectUri
			? 'justify-between'
			: 'justify-center'}"
	>
		{#if method === "qr" && runner.connectUri}
			<!-- Same session, other presentation: no restart (setPairMode) -->
			<TextLink type="button" onclick={() => activate("copy")}>
				{$_("login.connectCopyInstead")}
			</TextLink>
		{/if}
		<TextLink type="button" onclick={runner.cancel}>
			{$_("login.signerCancel")}
		</TextLink>
	</div>
{/snippet}

{#snippet body(method: NostrMethod)}
	<div class="space-y-3">
		{#if method === "qr"}
			{#if runner.connectUri}
				<div class="flex justify-center">
					<canvas bind:this={qrCanvas} class="rounded-lg bg-white p-2"></canvas>
				</div>
				{#if qrFailed}
					<p class="text-center {hintClass}">{$_("login.qrUnavailable")}</p>
				{/if}
			{/if}
			<p class={statusClass} role="status">
				{@render waitingDot()}
				{$_("login.connectWaiting")}
			</p>
			{@render runFooter(method)}
		{:else if method === "copy" || method === "open"}
			<p class={statusClass} role="status">
				{@render waitingDot()}
				{method === "open"
					? $_("login.signerWaiting")
					: $_("login.connectWaiting")}
			</p>
			{#if noAppHint}
				<p class="text-center {hintClass}" role="status">
					{$_("login.connectNoApp")}
				</p>
			{/if}
			{@render runFooter(method)}
		{:else if method === "saved"}
			{@render runFooter(method)}
		{:else if method === "bunker"}
			<p id="{uid}-bunker-hint" class={hintClass}>
				{$_("login.bunkerSubheading")}
			</p>
			<form onsubmit={connectWithBunker} class="space-y-2">
				<!-- Hand-rolled: the hint above already names this control, so a
				     field label would duplicate it. Classes mirror TextField. -->
				<input
					id="{uid}-bunker-uri"
					bind:this={bunkerInput}
					bind:value={bunkerUri}
					aria-label={$_("login.bunkerSubheading")}
					aria-describedby="{uid}-bunker-hint"
					placeholder="bunker://..."
					autocomplete="off"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
					class="w-full rounded-2xl border-2 {fieldBorderClasses(
						false,
					)} p-3 font-mono text-sm transition-all dark:bg-white/[0.15]"
				/>
				<button
					type="submit"
					disabled={!bunkerUri.trim()}
					aria-disabled={runner.anyLoading ? "true" : undefined}
					class={outlineButton}
				>
					{runner.signerRun === "bunker"
						? $_("login.signerWaiting")
						: $_(labels.bunkerAction)}
				</button>
			</form>
			{#if runner.signerRun === "bunker"}
				{@render runFooter(method)}
			{/if}
		{:else if method === "nsec"}
			<p id="{uid}-nsec-hint" class={hintClass}>{$_(labels.nsecHint)}</p>
			<form onsubmit={signWithNsec} class="space-y-2">
				<!-- Same hand-rolled shape: the hint above describes the field. -->
				<input
					id="{uid}-nsec"
					type="password"
					bind:this={nsecInput}
					bind:value={nsec}
					aria-label={$_("login.nsecLabel")}
					aria-describedby="{uid}-nsec-hint"
					placeholder="nsec1..."
					autocomplete="new-password"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
					class="w-full rounded-2xl border-2 {fieldBorderClasses(
						false,
					)} p-3 font-mono text-sm transition-all dark:bg-white/[0.15]"
				/>
				<button
					type="submit"
					disabled={!nsec.trim()}
					aria-disabled={runner.nsecLoading || runner.signerRun ? "true" : undefined}
					class={outlineButton}
				>
					{runner.nsecLoading ? $_("login.nostrSigning") : $_(labels.nsecAction)}
				</button>
			</form>
		{/if}
	</div>
{/snippet}

{#snippet row(method: NostrMethod)}
	{@const open = isOpen(method)}
	{@const hint = rowHint(method)}
	<div>
		<!-- A row with a body is a disclosure; the extension row just signs -->
		<button
			type="button"
			id="{uid}-row-{method}"
			onclick={() => toggleRow(method)}
			aria-expanded={method === "extension" ? undefined : open}
			aria-controls={method === "extension" ? undefined : `${uid}-body-${method}`}
			aria-disabled={isBlocked(method) ? "true" : undefined}
			class="{rowClass} {open ? rowOpen : ''}"
		>
			<span
				class="grid h-8 w-8 place-items-center rounded-lg {method === 'nsec'
					? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
					: 'bg-purple-600/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300'}"
			>
				<!-- Literals inline, not a lookup table: pnpm icons:generate bundles
				     only the names it can read off the <Icon> tag. -->
				<Icon
					type="material"
					icon={method === "extension"
						? "extension"
						: method === "open"
							? "open_in_new"
							: method === "qr"
								? "qr_code"
								: method === "copy"
									? "content_copy"
									: method === "bunker"
										? "link"
										: "warning"}
					w="18"
					h="18"
				/>
			</span>
			<span class="min-w-0">
				<span class="block font-semibold text-primary dark:text-white">
					{rowTitle(method)}
				</span>
				<!-- The nsec warning stays even in dense rows: it is the point -->
				{#if hint && (!dense || method === "nsec")}
					<span
						class="block text-xs {method === 'nsec'
							? 'text-amber-700 dark:text-amber-400'
							: 'text-body dark:text-white/65'}"
					>
						{hint}
					</span>
				{/if}
			</span>
			<Icon
				type="material"
				icon={open ? "expand_more" : "chevron_right"}
				w="16"
				h="16"
				class="text-body dark:text-white/50"
			/>
		</button>
		{#if open}
			<div
				id="{uid}-body-{method}"
				role="region"
				aria-labelledby="{uid}-row-{method}"
				class="{rowOpen} px-3.5 pb-3.5"
			>
				{@render body(method)}
			</div>
		{/if}
	</div>
{/snippet}

<div class="space-y-3">
	<!-- The extension signs in place; every other primary opens a body -->
	<button
		type="button"
		id="{uid}-primary"
		onclick={() => activate(layout.primary)}
		aria-expanded={layout.primary === "extension"
			? undefined
			: isOpen(layout.primary)}
		aria-controls={layout.primary === "extension"
			? undefined
			: `${uid}-primary-body`}
		aria-disabled={isBlocked(layout.primary) ? "true" : undefined}
		class={primaryButton}
	>
		<span class="truncate">{primaryLabel(layout.primary)}</span>
	</button>

	{#if layout.primary === "saved" && runner.savedPairing && runner.signerRun !== "saved"}
		<div class="flex items-center justify-between gap-3 {hintClass}">
			<span class="truncate" class:font-mono={savedSignerName === null}>
				{$_("login.signerSaved", { values: { name: savedName } })}
			</span>
			<TextLink
				type="button"
				onclick={forgetSigner}
				style="shrink-0 text-xs"
				aria-disabled={runner.anyLoading ? "true" : undefined}
			>
				{$_("login.signerForget")}
			</TextLink>
		</div>
	{/if}

	{#if isOpen(layout.primary)}
		<div
			id="{uid}-primary-body"
			role="region"
			aria-labelledby="{uid}-primary"
		>
			{@render body(layout.primary)}
		</div>
	{/if}

	{#if layout.rows.length > 0}
		<div class={listClass}>
			{#each layout.rows as method (method)}
				{@render row(method)}
			{/each}
		</div>
	{/if}

	<button
		type="button"
		onclick={toggleMore}
		aria-expanded={showMore}
		aria-controls="{uid}-more"
		class="mx-auto flex items-center gap-1 px-2 py-1.5 text-sm font-semibold text-link transition-colors hover:text-hover"
	>
		{$_("login.moreOptions")}
		<Icon
			type="material"
			icon="expand_more"
			w="18"
			h="18"
			class={showMore ? "rotate-180 transition-transform" : "transition-transform"}
		/>
	</button>

	{#if showMore}
		<div id="{uid}-more" class={listClass}>
			{#each layout.more as method (method)}
				{@render row(method)}
			{/each}
		</div>
	{/if}
</div>
