<script lang="ts">
import type { EventTemplate } from "nostr-tools/pure";
import { onDestroy, onMount, tick } from "svelte";

import { fieldBorderClasses } from "#lib/fieldStyles.js";
import { _ } from "#lib/i18n/index.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import { getNostrExtension } from "#lib/nostr.js";
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
	submit: (event: SignedAuthEvent) => Promise<boolean>;
	// Called before a transport starts signing: a caller that binds the
	// signature to something (the account being linked) snapshots it there,
	// before any await can outlive it.
	onStart?: () => void;
};

let { mode, template, submit, onStart }: Props = $props();

// Copy per surface: the transports are the same, the sentence under the
// button is not ("Log in with…" vs "Link with…"). The events are
// signerRun.svelte.ts's.
const LABELS = {
	login: {
		entry: "login.nostrLogin",
		extensionAction: "login.optionExtensionAction",
		bunkerAction: "login.bunkerConnect",
		nsecAction: "login.nsecSubmit",
		nsecHint: "login.nsecWarning",
		savedAction: "login.submit",
	},
	link: {
		entry: "account.nostr.linkEntry",
		extensionAction: "account.nostr.linkExtension",
		bunkerAction: "login.bunkerConnect",
		nsecAction: "account.nostr.linkNsec",
		nsecHint: "account.nostr.nsecWarning",
		savedAction: "account.nostr.linkSaved",
	},
} as const;

const labels = $derived(LABELS[mode]);

const primaryButton =
	"w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50 aria-disabled:opacity-50";
const outlineButton =
	"w-full rounded-lg border border-purple-600 px-4 py-2 font-semibold text-purple-600 transition-colors hover:bg-purple-600/10 disabled:opacity-50 aria-disabled:opacity-50 dark:border-purple-400 dark:text-purple-300 dark:hover:bg-purple-400/10";
// One card style for every transport, and one for the fields inside them: in
// dark the cards wear the same border as the fields they hold (the app's
// border-input token, which is what every other dark form control uses) with a
// fainter fill, so nothing in the flow out-shouts anything else.
const cardClass =
	"space-y-2 rounded-2xl border-2 border-input p-4 dark:bg-white/5";
const headingClass = "text-sm font-semibold text-primary dark:text-white";
const hintClass = "text-xs text-body dark:text-white/70";
const statusClass = "text-xs text-body dark:text-white/50";

let nsec = $state("");
let nsecInput = $state<HTMLInputElement>();
// A NIP-07 extension is only detectable in the browser, and it may inject after
// mount (or after the user installs one), so the button's state is refreshed on
// mount, on window focus and whenever the options panel opens.
let hasExtension = $state(false);

// One entry point, then every transport as an equal option: the extension is
// no longer privileged over a signer app or a QR pairing.
let showOptions = $state(false);
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
	submit: (event) => submit(event),
	onStart: () => onStart?.(),
	present: (uri, presentation, run) => {
		noAppHint = false;
		if (presentation === "qr") void renderQr(uri);
		else if (presentation === "open") handOff(uri, run);
		else void copyConnection(uri);
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

function toggleOptions() {
	showOptions = !showOptions;
	runner.optionsToggled(showOptions);
	if (showOptions) refreshExtension();
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

async function renderQr(uri: string) {
	await tick();
	if (!qrCanvas) return;
	try {
		const QRCode = await import("qrcode");
		await QRCode.default.toCanvas(qrCanvas, uri, { width: 200, margin: 1 });
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

onMount(() => {
	runner.restorePairing();
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

<!-- One entry point; the transports are equals inside the panel. -->
<button
	type="button"
	onclick={toggleOptions}
	aria-expanded={showOptions}
	class={primaryButton}
>
	<span class="flex items-center justify-center gap-1">
		{$_(labels.entry)}
		<Icon
			type="material"
			icon="expand_more"
			w="18"
			h="18"
			class={showOptions
				? "rotate-180 transition-transform"
				: "transition-transform"}
		/>
	</span>
</button>

{#if showOptions}
	<div class="space-y-3">
		{#if runner.savedPairing}
			<div class={cardClass}>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class={headingClass}>{$_("login.signerSaved")}</p>
						<p
							class="truncate {hintClass}"
							class:font-mono={savedSignerName === null}
						>
							{savedSignerName ??
								shortNpub(runner.savedPairing.npub ?? runner.savedPairing.pubkey)}
						</p>
					</div>
					<TextLink
						type="button"
						onclick={runner.forget}
						style="shrink-0 text-xs"
						aria-disabled={runner.anyLoading ? "true" : undefined}
					>
						{$_("login.signerForget")}
					</TextLink>
				</div>
				<button
					type="button"
					onclick={runner.useSavedPairing}
					aria-disabled={runner.anyLoading ? "true" : undefined}
					class={outlineButton}
				>
					{runner.signerRun === "saved"
						? $_("login.signerWaiting")
						: $_(labels.savedAction)}
				</button>
			</div>
		{/if}

		<!-- Equal options: same card, same button, no transport preferred. -->
		<div class={cardClass}>
			<p class={headingClass}>{$_("login.optionExtension")}</p>
			<p class={hintClass}>
				{hasExtension
					? $_("login.optionExtensionHint")
					: $_("login.nostrNoExtension")}
			</p>
			<button
				type="button"
				onclick={signWithExtension}
				disabled={!hasExtension}
				aria-disabled={runner.anyLoading ? "true" : undefined}
				class={outlineButton}
			>
				{runner.nostrLoading ? $_("login.nostrSigning") : $_(labels.extensionAction)}
			</button>
		</div>

		<div class={cardClass}>
			<p class={headingClass}>{$_("login.optionConnect")}</p>
			<p class={hintClass}>
				{$_("login.optionConnectHint")}
			</p>
			<div class="flex flex-col gap-2">
				<button
					type="button"
					onclick={() => runner.startPairing("open")}
					aria-disabled={runner.pairButtonsDisabled ? "true" : undefined}
					class={outlineButton}
				>
					{$_("login.connectOpen")}
				</button>
				<button
					type="button"
					onclick={() => runner.startPairing("copy")}
					aria-disabled={runner.pairButtonsDisabled ? "true" : undefined}
					class={outlineButton}
				>
					{copied ? $_("login.connectCopied") : $_("login.connectCopy")}
				</button>
				<button
					type="button"
					onclick={() => runner.startPairing("qr")}
					aria-disabled={runner.pairButtonsDisabled ? "true" : undefined}
					class={outlineButton}
				>
					{$_("login.connectShow")}
				</button>
			</div>

			{#if noAppHint}
				<p class={hintClass} role="status">
					{$_("login.connectNoApp")}
				</p>
			{/if}

			<!-- QR only: the connection string is a separate action, so this
			     view holds nothing but the code to scan. -->
			{#if runner.pairMode === "qr" && runner.connectUri}
				<div class="space-y-2">
					<div class="flex justify-center">
						<canvas
							bind:this={qrCanvas}
							class="rounded-lg bg-white p-2"
						></canvas>
					</div>
					{#if qrFailed}
						<p class="text-center {hintClass}">
							{$_("login.qrUnavailable")}
						</p>
					{/if}
				</div>
			{/if}

			{#if runner.pairingSession}
				<p class="text-center {statusClass}" role="status">
					{runner.pairMode === "open"
						? $_("login.signerWaiting")
						: $_("login.connectWaiting")}
				</p>
			{/if}
		</div>

		<div class={cardClass}>
			<p class={headingClass}>{$_("login.optionBunker")}</p>
			<p id="{mode}-bunker-hint" class={hintClass}>
				{$_("login.bunkerSubheading")}
			</p>
			<form onsubmit={connectWithBunker} class="space-y-2">
				<!-- Hand-rolled: the subheading above already names this control, so
				     a field label would duplicate it. Classes mirror TextField. -->
				<input
					id="{mode}-bunker-uri"
					bind:value={bunkerUri}
					aria-label={$_("login.bunkerSubheading")}
					aria-describedby="{mode}-bunker-hint"
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
		</div>

		<div class={cardClass}>
			<p class={headingClass}>{$_("login.optionNsec")}</p>
			<p id="{mode}-nsec-hint" class={hintClass}>
				{$_(labels.nsecHint)}
			</p>
			<form onsubmit={signWithNsec} class="space-y-2">
				<!-- Same hand-rolled shape: the subheading above describes the field. -->
				<input
					id="{mode}-nsec"
					type="password"
					bind:this={nsecInput}
					bind:value={nsec}
					aria-label={$_("login.nsecLabel")}
					aria-describedby="{mode}-nsec-hint"
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
		</div>

		{#if runner.signerRun}
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
			<TextLink
				type="button"
				onclick={runner.cancel}
				style="block w-full text-center text-sm"
			>
				{$_("login.signerCancel")}
			</TextLink>
		{/if}
	</div>
{/if}
