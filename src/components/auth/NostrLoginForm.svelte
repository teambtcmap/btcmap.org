<script lang="ts">
import { onDestroy, onMount, tick } from "svelte";
import { get } from "svelte/store";

import type { EventName } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import api from "#lib/axios.js";
import { fieldBorderClasses } from "#lib/fieldStyles.js";
import { _ } from "#lib/i18n/index.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import {
	decodeNsec,
	encodeNip98Event,
	getNostrExtension,
	NOSTR_AUTH_URL,
	parseNostrAuthResponse,
	signAuthWithExtension,
	signAuthWithSecretKey,
} from "#lib/nostr.js";
import { fetchProfile } from "#lib/nostrProfile.js";
import type {
	Closable,
	SignerPairing,
	SignerSession,
} from "#lib/nostrSigner.js";
import {
	classifySignerError,
	clearSignerPairing,
	closeSigner,
	connectBunkerUri,
	connectSavedPairing,
	hasErrorName,
	loadSignerPairing,
	pairingWithSignerKey,
	saveSignerPairing,
	shortNpub,
	signWithSigner,
	startNostrConnect,
} from "#lib/nostrSigner.js";
import { safeHttpUrl } from "#lib/safeUrl.js";
import type { Session } from "#lib/session.js";
import { session } from "#lib/session.js";
import { errToast } from "#lib/utils.js";
import Icon from "$components/Icon.svelte";
import TextLink from "$components/TextLink.svelte";

type Props = {
	// Mirrors LoginForm's contract: caller decides what happens after a
	// successful login (navigate, complete a pending save, etc.).
	onSuccess: (session: Session) => void | Promise<void>;
};

let { onSuccess }: Props = $props();

// Which signer transport is running. "qr", "open" and "copy" share one
// nostrconnect session; the mode only decides how its URI is presented.
type SignerRun = "saved" | "bunker" | "qr" | "open" | "copy";
type PairMode = "qr" | "open" | "copy";

const CONNECT_CLICK = {
	qr: "login_nostr_connect_qr_click",
	open: "login_nostr_connect_open_click",
	copy: "login_nostr_connect_copy_click",
} as const satisfies Record<PairMode, EventName>;

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
let nostrLoading = $state(false);
let nsecLoading = $state(false);

// One entry point, then every transport as an equal option: the extension is
// no longer privileged over a signer app or a QR pairing.
let showOptions = $state(false);
let savedPairing = $state<SignerPairing | null>(null);
// kind:0 name for the saved signer, when public relays have one.
let savedSignerName = $state<string | null>(null);
let profileFor: string | null = null;
let bunkerUri = $state("");
let signerRun = $state<SignerRun | null>(null);
let pairMode = $state<PairMode | null>(null);
let connectUri = $state<string | null>(null);
let copied = $state(false);
let qrFailed = $state(false);
let qrCanvas = $state<HTMLCanvasElement | null>(null);
let noAppHint = $state(false);

// Stale results are the danger here: a signer that answers after Cancel must
// not complete the login. Every run captures the generation, and any await
// that comes back with a stale one is dropped (and its signer closed).
let generation = 0;
let abortController: AbortController | null = null;
let activeSigner: Closable | null = null;
let noAppTimer: ReturnType<typeof setTimeout> | null = null;
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const anyLoading = $derived(nostrLoading || nsecLoading || signerRun !== null);
const pairingSession = $derived(
	signerRun === "qr" || signerRun === "open" || signerRun === "copy",
);
// A pairing in progress still owns its three buttons (switching between QR,
// copy and hand-off must not restart it); everything else blocks them.
const pairButtonsDisabled = $derived(
	nostrLoading || nsecLoading || (signerRun !== null && !pairingSession),
);

async function exchangeSignedEvent(signedEvent: SignedAuthEvent) {
	// Straight against the API per NIP-98 (it answers CORS preflights,
	// #1348). NOSTR_AUTH_URL is the same constant the signed `u` tag is
	// built from — the signature binds to the URL, so they must never
	// diverge. undefined (not null) so axios sends no body and no
	// content-type: a body would require a payload-hash tag in the event.
	const res = await api.post(NOSTR_AUTH_URL, undefined, {
		headers: { Authorization: `Nostr ${encodeNip98Event(signedEvent)}` },
	});

	const { token, username, npub } = parseNostrAuthResponse(res.data);

	// Empty password — Nostr-linked accounts back up via the Nostr key,
	// not via a stored password. autoGenerated stays false (set by
	// session.login), so BackupModal won't show a password field. The npub
	// is persisted on the session to drive the user's Nostr avatar.
	session.login(username, "", token, npub);

	const current = get(session);
	if (!current) throw new Error("session.login did not populate the store");

	await onSuccess(current);
}

// The HTTP status of an API failure, if it was one. Shared by the toast paths:
// a 401/403 means the API rejected the signature, not that the transport broke.
function httpStatus(err: unknown): number | undefined {
	return (err as { response?: { status?: number } })?.response?.status;
}

function showLoginError(err: unknown, logLabel: string) {
	const status = httpStatus(err);
	errToast(
		status === 401 || status === 403
			? $_("login.nostrFailed")
			: $_("login.nostrError"),
	);
	console.error(logLabel, status ?? err);
}

function failSigner(err: unknown, run: number) {
	if (run !== generation || hasErrorName(err, "AbortError")) return;
	cancelSigner();
	// An API rejection is the same failure the other transports report, so it
	// gets the same "signature rejected" wording rather than a signer message.
	const status = httpStatus(err);
	if (status !== undefined) {
		showLoginError(err, "Nostr signer login failed:");
		return;
	}
	switch (classifySignerError(err)) {
		case "invalid":
			errToast($_("login.bunkerInvalid"));
			return;
		case "timeout":
			errToast($_("login.signerNoAnswer"));
			return;
		case "relay":
			errToast($_("login.signerNoRelay"));
			return;
		default: {
			// A signer that refuses says why (Opal: "already connected", "user
			// rejected", …); that text is the only clue the user has, so it
			// rides along with the generic message.
			const detail =
				typeof err === "string" ? err : (err as Error | undefined)?.message;
			errToast(
				detail
					? `${$_("login.nostrError")} (${detail})`
					: $_("login.nostrError"),
			);
			console.error("Nostr signer login failed:", err);
		}
	}
}

// auth_url comes from the signer, so it is untrusted input on its way to a new
// tab: only http(s) survives.
function openAuthUrl(url: string) {
	const safe = safeHttpUrl(url);
	if (!safe) {
		console.warn("nostrSigner: refused a non-http auth_url");
		return;
	}
	window.open(safe, "_blank", "noopener");
}

// Abandon everything in flight: bump the generation, abort the pairing wait,
// close the signer if one was established, and clear the pairing UI.
function cancelSigner() {
	generation += 1;
	abortController?.abort();
	abortController = null;
	if (noAppTimer) {
		clearTimeout(noAppTimer);
		noAppTimer = null;
	}
	if (copiedTimer) {
		clearTimeout(copiedTimer);
		copiedTimer = null;
	}
	if (activeSigner) void closeSigner(activeSigner);
	activeSigner = null;
	signerRun = null;
	connectUri = null;
	pairMode = null;
	copied = false;
	qrFailed = false;
	noAppHint = false;
}

function beginSignerRun(run: SignerRun): number {
	cancelSigner();
	signerRun = run;
	return generation;
}

function forgetSigner() {
	trackEvent("login_nostr_forget_click");
	clearSignerPairing();
	savedPairing = null;
	cancelSigner();
}

function toggleOptions() {
	showOptions = !showOptions;
	trackEvent("login_nostr_options_toggle", { open: showOptions });
	if (!showOptions) cancelSigner();
}

async function loginWithExtension() {
	// Re-entry guard: the busy button still takes clicks (#1548). Without
	// it, one click could open two extension-signing popups.
	if (anyLoading) return;
	trackEvent("login_nostr_extension_click");
	// Detect at click time rather than at mount: extensions inject
	// window.nostr at their own pace, and a user without one gets told what
	// to install instead of never seeing the option.
	if (getNostrExtension() === null) {
		errToast($_("login.nostrNoExtension"));
		return;
	}
	nostrLoading = true;
	try {
		const signed = await signAuthWithExtension();
		await exchangeSignedEvent(signed);
		trackEvent("login_nostr_success", { method: "extension" });
	} catch (err) {
		showLoginError(err, "Nostr extension login failed:");
	} finally {
		nostrLoading = false;
	}
}

// Sign the NIP-98 event, exchange it for a session, and only then persist the
// pairing — a pairing is worth remembering once it has actually logged someone
// in. The form stays booked (signerRun set) through the exchange, so a second
// login cannot start mid-request; the caller's finally closes the signer.
async function finishSignerRun(
	run: number,
	signer: SignerSession["signer"],
	pairing: SignerPairing,
	method: SignerRun,
): Promise<void> {
	if (run !== generation) return;
	activeSigner = signer;
	const signed = await signWithSigner(signer);
	if (run !== generation) return;
	await exchangeSignedEvent(signed);
	trackEvent("login_nostr_success", { method });
	// No generation check here: exchangeSignedEvent awaits onSuccess, and the
	// add-location flow closes this form on success — onDestroy -> cancelSigner
	// bumps the generation. The exchange succeeded either way, so the pairing is
	// still worth keeping. It also carries the user's key as named by the signed
	// event, where the bunker pointer names the signer's (they differ on
	// signers like nsec.app).
	const verified = pairingWithSignerKey(pairing, signed.pubkey);
	saveSignerPairing(verified);
	savedPairing = verified;
}

async function loginWithSavedPairing() {
	const pairing = savedPairing;
	if (!pairing || anyLoading) return;
	trackEvent("login_nostr_saved_click");
	const run = beginSignerRun("saved");
	let signer: SignerSession["signer"] | null = null;
	try {
		const result = await connectSavedPairing(pairing, {
			onauth: openAuthUrl,
		});
		signer = result.signer;
		await finishSignerRun(run, signer, result.pairing, "saved");
	} catch (err) {
		failSigner(err, run);
		// A pairing the signer no longer knows is worse than none: drop it so
		// the one-click button doesn't fail forever. After the toast — forgetting
		// bumps the generation, which would swallow it.
		if (classifySignerError(err) === "invalid") forgetSigner();
	} finally {
		await closeSigner(signer);
		// Only this run's signer: a cancelled run that resolves late must not
		// clear the signer a newer run is holding, or cancelling that one leaks
		// its request until the sign timeout.
		if (activeSigner === signer) activeSigner = null;
		if (run === generation) signerRun = null;
	}
}

async function connectWithBunker(event: SubmitEvent) {
	event.preventDefault();
	if (anyLoading) return;
	const value = bunkerUri.trim();
	if (!value) return;
	trackEvent("login_nostr_bunker_click");
	const run = beginSignerRun("bunker");
	let signer: SignerSession["signer"] | null = null;
	try {
		const result = await connectBunkerUri(value, { onauth: openAuthUrl });
		signer = result.signer;
		await finishSignerRun(run, signer, result.pairing, "bunker");
		if (run === generation) bunkerUri = "";
	} catch (err) {
		failSigner(err, run);
	} finally {
		await closeSigner(signer);
		// Only this run's signer: a cancelled run that resolves late must not
		// clear the signer a newer run is holding, or cancelling that one leaks
		// its request until the sign timeout.
		if (activeSigner === signer) activeSigner = null;
		if (run === generation) signerRun = null;
	}
}

async function startPairing(mode: PairMode) {
	// Another transport is running: the buttons are aria-disabled, and the
	// click they still take must not start a second session. Deliberately not
	// anyLoading — switching between QR, open and copy has to work while this
	// pairing is running.
	if (nostrLoading || nsecLoading) return;
	trackEvent(CONNECT_CLICK[mode]);
	// One nostrconnect session, two presentations: switching after the URI
	// exists must not restart the pairing the signer may be answering.
	if (signerRun) {
		if (connectUri) setPairMode(mode);
		return;
	}

	const run = beginSignerRun(mode);
	const controller = new AbortController();
	abortController = controller;
	pairMode = mode;
	let signer: SignerSession["signer"] | null = null;
	try {
		const result = await startNostrConnect({
			signal: controller.signal,
			onauth: openAuthUrl,
			onUri: (uri) => {
				if (run !== generation) return;
				connectUri = uri;
				if (mode === "qr") void renderQr(uri);
				else if (mode === "open") handOff(uri, run);
				else void copyConnection(uri);
			},
		});
		signer = result.signer;
		await finishSignerRun(run, signer, result.pairing, mode);
	} catch (err) {
		failSigner(err, run);
	} finally {
		await closeSigner(signer);
		// Only this run's signer: a cancelled run that resolves late must not
		// clear the signer a newer run is holding, or cancelling that one leaks
		// its request until the sign timeout.
		if (activeSigner === signer) activeSigner = null;
		if (run === generation) {
			abortController = null;
			signerRun = null;
			connectUri = null;
			pairMode = null;
		}
	}
}

function setPairMode(mode: PairMode) {
	pairMode = mode;
	noAppHint = false;
	if (!connectUri) return;
	if (mode === "qr") void renderQr(connectUri);
	else if (mode === "open") handOff(connectUri, generation);
	else void copyConnection(connectUri);
}

// A scheme with no registered handler is ignored silently — the page just
// stays put — so point at the QR/copy routes if nothing opens.
function handOff(uri: string, run: number) {
	window.location.href = uri;
	if (noAppTimer) clearTimeout(noAppTimer);
	noAppTimer = setTimeout(() => {
		if (run === generation) noAppHint = true;
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

async function loginWithNsec(event: SubmitEvent) {
	event.preventDefault();
	// Re-entry guard: the busy button still takes clicks (#1548), which
	// would decode + sign the same nsec twice and double-fire the exchange.
	// Nor while another login runs: both would call onSuccess.
	if (anyLoading) return;
	if (!nsec.trim()) return;
	trackEvent("login_nostr_nsec_click");
	nsecLoading = true;
	let secretKey: Uint8Array | null = null;

	// Phase 1: decode + sign (sync, only fails on malformed key).
	let signed: SignedAuthEvent;
	try {
		secretKey = decodeNsec(nsec);
		signed = signAuthWithSecretKey(secretKey);
		nsec = "";
	} catch {
		errToast($_("login.nsecInvalid"));
		console.error("Nsec decode failed");
		if (secretKey) secretKey.fill(0);
		nsecLoading = false;
		return;
	}

	// Phase 2: network exchange. Reuses the same bad-credentials classifier
	// so transport errors don't get mis-reported as "invalid nsec".
	try {
		await exchangeSignedEvent(signed);
		trackEvent("login_nostr_success", { method: "nsec" });
	} catch (err) {
		showLoginError(err, "Nsec login failed:");
		// The key was cleared before the exchange, so the empty field
		// disables the focused submit (#1548): retrying starts there anyway.
		nsecInput?.focus();
	} finally {
		// Best-effort zeroing. V8 may have copies elsewhere, but this covers
		// the primary reference.
		if (secretKey) secretKey.fill(0);
		nsecLoading = false;
	}
}

onMount(() => {
	savedPairing = loadSignerPairing();
});

// Name the saved signer by its kind:0 profile when one exists, and fall back
// to the shortened npub otherwise. fetchProfile caches per key and resolves to
// null on timeout, so a dead relay just leaves the npub on screen.
$effect(() => {
	const npub = savedPairing?.npub ?? null;
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
	cancelSigner();
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
		{$_("login.nostrLogin")}
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
		{#if savedPairing}
			<div class={cardClass}>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class={headingClass}>{$_("login.signerSaved")}</p>
						<p
							class="truncate {hintClass}"
							class:font-mono={savedSignerName === null}
						>
							{savedSignerName ??
								shortNpub(savedPairing.npub ?? savedPairing.pubkey)}
						</p>
					</div>
					<TextLink
						type="button"
						onclick={forgetSigner}
						style="shrink-0 text-xs"
						aria-disabled={anyLoading ? "true" : undefined}
					>
						{$_("login.signerForget")}
					</TextLink>
				</div>
				<button
					type="button"
					onclick={loginWithSavedPairing}
					aria-disabled={anyLoading ? "true" : undefined}
					class={outlineButton}
				>
					{signerRun === "saved"
						? $_("login.signerWaiting")
						: $_("login.submit")}
				</button>
			</div>
		{/if}

		<!-- Equal options: same card, same button, no transport preferred. -->
		<div class={cardClass}>
			<p class={headingClass}>{$_("login.optionExtension")}</p>
			<p class={hintClass}>
				{$_("login.optionExtensionHint")}
			</p>
			<button
				type="button"
				onclick={loginWithExtension}
				aria-disabled={anyLoading ? "true" : undefined}
				class={outlineButton}
			>
				{nostrLoading
					? $_("login.nostrSigning")
					: $_("login.optionExtensionAction")}
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
					onclick={() => startPairing("open")}
					aria-disabled={pairButtonsDisabled ? "true" : undefined}
					class={outlineButton}
				>
					{$_("login.connectOpen")}
				</button>
				<button
					type="button"
					onclick={() => startPairing("copy")}
					aria-disabled={pairButtonsDisabled ? "true" : undefined}
					class={outlineButton}
				>
					{copied ? $_("login.connectCopied") : $_("login.connectCopy")}
				</button>
				<button
					type="button"
					onclick={() => startPairing("qr")}
					aria-disabled={pairButtonsDisabled ? "true" : undefined}
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
			{#if pairMode === "qr" && connectUri}
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

			{#if pairingSession}
				<p class="text-center {statusClass}" role="status">
					{pairMode === "open"
						? $_("login.signerWaiting")
						: $_("login.connectWaiting")}
				</p>
			{/if}
		</div>

		<div class={cardClass}>
			<p class={headingClass}>{$_("login.optionBunker")}</p>
			<p id="bunker-hint" class={hintClass}>
				{$_("login.bunkerSubheading")}
			</p>
			<form onsubmit={connectWithBunker} class="space-y-2">
				<!-- Hand-rolled: the subheading above already names this control, so
				     a field label would duplicate it. Classes mirror TextField. -->
				<input
					id="bunker-uri"
					bind:value={bunkerUri}
					aria-label={$_("login.bunkerSubheading")}
					aria-describedby="bunker-hint"
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
					aria-disabled={anyLoading ? "true" : undefined}
					class={outlineButton}
				>
					{signerRun === "bunker"
						? $_("login.signerWaiting")
						: $_("login.bunkerConnect")}
				</button>
			</form>
		</div>

		<div class={cardClass}>
			<p class={headingClass}>{$_("login.optionNsec")}</p>
			<p id="nsec-hint" class={hintClass}>
				{$_("login.nsecWarning")}
			</p>
			<form onsubmit={loginWithNsec} class="space-y-2">
				<!-- Same hand-rolled shape: the subheading above describes the field. -->
				<input
					id="nsec"
					type="password"
					bind:this={nsecInput}
					bind:value={nsec}
					aria-label={$_("login.nsecLabel")}
					aria-describedby="nsec-hint"
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
					aria-disabled={nsecLoading || signerRun ? "true" : undefined}
					class={outlineButton}
				>
					{nsecLoading ? $_("login.nostrSigning") : $_("login.nsecSubmit")}
				</button>
			</form>
		</div>

		{#if signerRun}
			<TextLink
				type="button"
				onclick={cancelSigner}
				style="block w-full text-center text-sm"
			>
				{$_("login.signerCancel")}
			</TextLink>
		{/if}
	</div>
{/if}
