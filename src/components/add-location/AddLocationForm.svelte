<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import { onMount, tick } from "svelte";
import { get } from "svelte/store";

import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";
import FormHelperText from "$components/FormHelperText.svelte";
import type { FormSelectOption } from "$components/form/FormSelect.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import OpeningHoursEditor from "$components/form/OpeningHoursEditor.svelte";
import TextField from "$components/form/TextField.svelte";
import Icon from "$components/Icon.svelte";
import NostrAvatar from "$components/NostrAvatar.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { trackEvent } from "$lib/analytics";
import { CATEGORIES, CATEGORY_GROUPS } from "$lib/categoryMapping";
import { reverseGeocode } from "$lib/geocoding";
import { _, locale } from "$lib/i18n";
import type {
	SubmitPlaceRequest,
	SubmitPlaceResponse,
} from "$lib/placeSubmission";
import { session } from "$lib/session";
import { theme } from "$lib/theme";
import { errToast } from "$lib/utils";

// The add-location details form, extracted from the /add-location page so
// the map's placement side-panel can host the same component (#1134). The
// pin always comes from placement mode — hosts guarantee valid coords —
// so the form is details-first by construction. The host owns the success
// state; on a completed submission the form calls `onsuccess`.
type Props = {
	coords: { lat: number; long: number };
	// `attributed` = the submission went out with a verified account
	// attached — the host's success screen skips the account nudge then.
	onsuccess: (attributed: boolean) => void;
};
let { coords, onsuccess }: Props = $props();

let captchaContent = $state("");
let isCaptchaLoading = $state(true);
let captchaSecret = $state<string>();
let captchaInput = $state<HTMLInputElement>();
let honeyInput = $state<HTMLInputElement>();

const fetchCaptcha = () => {
	isCaptchaLoading = true;
	axios
		.get<{ captcha: string; captchaSecret: string }>("/captcha")
		.then((response) => {
			captchaSecret = response.data.captchaSecret;
			captchaContent = DOMPurify.sanitize(response.data.captcha);
		})
		.catch((error) => {
			errToast(get(_)("errors.captchaFetch"));
			console.error(error);
		})
		.finally(() => {
			isCaptchaLoading = false;
		});
};

let name = $state<HTMLInputElement>();
let nameEn = $state<HTMLInputElement>();
let address = $state<HTMLInputElement>();
let showMoreDetails = $state(false);

// One-shot desktop nicety: hand focus to the name field once the inputs
// unlock (the captcha gates them via `disabled`).
let nameFocusPending = $state(false);
$effect(() => {
	if (nameFocusPending && captchaSecret && name) {
		nameFocusPending = false;
		// Wait out the same render that flips the input's `disabled` off —
		// focusing a still-disabled element is a silent no-op.
		const el = name;
		tick().then(() => el?.focus());
	}
});

// Address suggestion from the pin (#1315). Re-runs whenever the pin
// moves — a live-adjust host, or history navigation between two arrivals
// keeps this instance alive with new coords. A fulfilled suggestion flips
// the field to required, so it can be corrected but not blanked out; a
// miss leaves it optional, exactly the pre-suggestion behavior.
let addressPending = $state(true);
let addressRequired = $state(false);
// What the lookup last wrote — tells an untouched suggestion apart from
// user-typed text when the pin moves, and gates a superseded lookup.
let lastSuggested = "";
let lookupToken = 0;

const suggestAddress = async (lat: number, long: number) => {
	const token = ++lookupToken;
	addressPending = true;
	const suggestion = await reverseGeocode(lat, long, get(locale) ?? "en");
	// The pin moved again while this lookup was in flight — drop it.
	if (token !== lookupToken) return;
	addressPending = false;
	trackEvent("add_place_address_prefill", {
		outcome: suggestion ? "hit" : "miss",
	});
	// Required on every hit — OSM knows an address here, so blank is never
	// right. The value guard only replaces an empty field or the previous
	// pin's untouched suggestion; text the user typed (or autofill wrote)
	// stays put.
	if (suggestion) {
		addressRequired = true;
		if (address && (!address.value || address.value === lastSuggested)) {
			address.value = suggestion;
		}
		lastSuggested = suggestion;
	} else {
		addressRequired = false;
		if (address && address.value === lastSuggested) {
			address.value = "";
		}
		lastSuggested = "";
	}
};

$effect(() => {
	// Mount included — coords are the only tracked reads (everything else
	// sits behind the await).
	suggestAddress(coords.lat, coords.long);
});

let categorySelect = $state<string>();
let categoryOther = $state<string>();
let categoryOtherElement = $state<HTMLInputElement>();

// Map taxonomy minus the "all" pseudo-bucket, plus the Other escape
// hatch — labels verbatim from the map UI.
const categoryOptions: FormSelectOption[] = CATEGORIES.filter(
	(key) => key !== "all",
).map((key) => ({ value: key, label: CATEGORY_GROUPS[key].label }));

let onchain = $state<HTMLInputElement>();
let lightning = $state<HTMLInputElement>();
let nfc = $state<HTMLInputElement>();
let website = $state<HTMLInputElement>();
let phone = $state<HTMLInputElement>();
// Structured editor state instead of an element ref: the day-grid editor
// binds the OSM opening_hours string it generates.
let hoursValue = $state("");
let showHoursEditor = $state(false);
let notes = $state<HTMLTextAreaElement>();
let contact = $state<HTMLInputElement>();
let noMethodSelected = $state(false);
let submitting = $state(false);

// Per-submission anonymity (#1334): someone on a shared device can
// detach the signed-in account from THIS submission without logging
// out. Detached = the plain anonymous contract (required email, no
// Authorization header). The trimmed-token check guards against a
// corrupted stored session (empty or whitespace-only token) posing as
// an attachable identity.
let submitAnonymously = $state(false);
let showDetach = $state(false);
// The signed-out inline sign-in (#1334): the existing auth forms expand
// in place, so typed fields survive — no navigation.
let showSignIn = $state(false);
const identityAttached = $derived(
	!!$session?.token.trim() && !submitAnonymously,
);

const onAuthSuccess = () => {
	// The forms set the session store themselves — collapse and let the
	// chip take over (a fresh login also clears a previous detach).
	showSignIn = false;
	submitAnonymously = false;
};

const handleCheckboxClick = () => {
	noMethodSelected = false;
};

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (categorySelect === "Other" && !(categoryOther ?? "").trim()) {
		errToast(get(_)("addLocation.categoryOtherRequired"));
		categoryOtherElement?.focus();
		return;
	}
	if (!onchain?.checked && !lightning?.checked && !nfc?.checked) {
		noMethodSelected = true;
		errToast(get(_)("errors.noPaymentMethod"));
	} else {
		submitting = true;
		const methods: ("onchain" | "lightning" | "nfc")[] = [];
		if (onchain?.checked) {
			methods.push("onchain");
		}
		if (lightning?.checked) {
			methods.push("lightning");
		}
		if (nfc?.checked) {
			methods.push("nfc");
		}

		const payload: SubmitPlaceRequest = {
			captchaSecret,
			captchaTest: captchaInput?.value,
			honey: honeyInput?.value,
			name: name?.value,
			nameEn: nameEn?.value,
			address: address?.value,
			lat: coords.lat,
			long: coords.long,
			category:
				categorySelect === "Other"
					? (categoryOther ?? "").trim()
					: (categorySelect ?? ""),
			methods,
			website: website?.value,
			phone: phone?.value,
			hours: hoursValue,
			notes: notes?.value,
			contact: contact?.value,
		};

		axios
			.post<SubmitPlaceResponse>(
				"/api/submit-place",
				payload,
				// The endpoint verifies the token and attaches the account to
				// the submission (#1334); no session (or a detached one), no
				// header — anonymous.
				identityAttached && $session
					? { headers: { Authorization: `Bearer ${$session.token.trim()}` } }
					: undefined,
			)
			.then((response) => {
				// The server's verdict, not the client's belief — a stale
				// token lands anonymous despite the chip.
				onsuccess(response.data?.attributed === true);
			})
			.catch((error) => {
				// Our endpoint's 4xx messages are written for users (captcha,
				// missing contact on an anonymous fallback, …) — show them.
				const message = error.response?.data?.message;
				if (message && error.response.status < 500) {
					errToast(message);
				} else {
					errToast(get(_)("errors.formSubmission"));
				}
				console.error(error);
				submitting = false;
			});
	}
};

onMount(() => {
	// fetch and add captcha
	fetchCaptcha();

	// Keyboard-first on desktop only: popping the on-screen keyboard
	// on mobile would cover the confirmation the user just landed on.
	nameFocusPending = window.matchMedia("(pointer: fine)").matches;
});
</script>

<form onsubmit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
	<TextField
		id="name"
		name="name"
		label={$_('addLocation.nameLabel')}
		bind:element={name}
		disabled={!captchaSecret}
		placeholder={$_('addLocation.merchantNamePlaceholder')}
		required
	/>

	<TextField
		id="address"
		name="address"
		label={$_('forms.address')}
		optional={!addressRequired}
		bind:element={address}
		disabled={!captchaSecret}
		required={addressRequired}
		placeholder={addressPending
			? $_('addLocation.addressLookupPending')
			: $_('addLocation.addressPlaceholder')}
	>
		{#snippet hint()}
			<FormHelperText text={$_('addLocation.addressSuggestedHint')} />
		{/snippet}
	</TextField>

	<div>
		<label for="category" class="mb-2 block font-semibold">{$_('forms.category')}</label>
		<FormSelect
			id="category"
			disabled={!captchaSecret}
			name="category"
			required
			options={[
				{ value: '', label: $_('addLocation.categorySelectPlaceholder') },
				...categoryOptions,
				{ value: 'Other', label: $_('addLocation.categoryOtherOption') }
			]}
			bind:value={categorySelect}
			on:change={async () => {
				if (categorySelect === 'Other') {
					await tick();
					categoryOtherElement?.focus();
				}
			}}
		/>
		{#if categorySelect === 'Other'}
			<input
				disabled={!captchaSecret}
				required
				type="text"
				name="category-other"
				placeholder={$_('addLocation.categoryPlaceholder')}
				class="mt-2 w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				bind:value={categoryOther}
				bind:this={categoryOtherElement}
			/>
		{/if}
	</div>

	<fieldset>
		<legend class="mb-2 block font-semibold">{$_('addLocation.paymentMethodsLegend')}</legend>
		{#if noMethodSelected}
			<span class="font-semibold text-error">{$_('addLocation.paymentMethodError')}</span>
		{/if}
		<div class="space-y-4">
			<div>
				<input
					class="h-4 w-4 accent-link"
					disabled={!captchaSecret}
					type="checkbox"
					name="onchain"
					id="onchain"
					bind:this={onchain}
					onclick={handleCheckboxClick}
				/>
				<label for="onchain" class="ml-1 cursor-pointer">
					{#if typeof window !== 'undefined'}
						<img
							src={$theme === 'dark'
								? '/icons/btc-highlight-dark.svg'
								: '/icons/btc-primary.svg'}
							alt=""
							class="inline"
						/>
					{/if}
					{$_('addLocation.onchainLabel')}
				</label>
			</div>
			<div>
				<input
					class="h-4 w-4 accent-link"
					disabled={!captchaSecret}
					type="checkbox"
					name="lightning"
					id="lightning"
					bind:this={lightning}
					onclick={handleCheckboxClick}
				/>
				<label for="lightning" class="ml-1 cursor-pointer">
					{#if typeof window !== 'undefined'}
						<img
							src={$theme === 'dark'
								? '/icons/ln-highlight-dark.svg'
								: '/icons/ln-primary.svg'}
							alt=""
							class="inline"
						/>
					{/if}
					{$_('addLocation.lightningLabel')}
				</label>
			</div>
			<div>
				<input
					class="h-4 w-4 accent-link"
					disabled={!captchaSecret}
					type="checkbox"
					name="nfc"
					id="nfc"
					bind:this={nfc}
					onclick={handleCheckboxClick}
				/>
				<label for="nfc" class="ml-1 cursor-pointer">
					{#if typeof window !== 'undefined'}
						<img
							src={$theme === 'dark'
								? '/icons/nfc-highlight-dark.svg'
								: '/icons/nfc-primary.svg'}
							alt=""
							class="inline"
						/>
					{/if}
					{$_('addLocation.nfcLabel')}
				</label>
			</div>
		</div>
	</fieldset>

	<div>
		<button
			type="button"
			class="flex items-center gap-1 text-sm font-semibold text-link hover:text-hover focus:outline-link"
			aria-expanded={showMoreDetails}
			onclick={() => (showMoreDetails = !showMoreDetails)}
		>
			<Icon
				type="material"
				icon="expand_more"
				w="16"
				h="16"
				class={showMoreDetails ? 'rotate-180' : ''}
			/>
			{$_('addLocation.moreDetailsToggle')}
		</button>
	</div>

	<div class="space-y-5" class:hidden={!showMoreDetails}>
		<TextField
			id="name-en"
			name="nameEn"
			label={$_('addLocation.nameEnLabel')}
			optional
			bind:element={nameEn}
			disabled={!captchaSecret}
			placeholder={$_('addLocation.merchantEnglishNamePlaceholder')}
		>
			{#snippet hint()}
				<FormHelperText text={$_('addLocation.nameEnTooltip')} />
			{/snippet}
		</TextField>

		<TextField
			id="website"
			name="website"
			label={$_('forms.website')}
			optional
			type="url"
			bind:element={website}
			disabled={!captchaSecret}
			placeholder={$_('addLocation.websitePlaceholder')}
		/>

		<TextField
			id="phone"
			name="phone"
			label={$_('forms.phone')}
			optional
			type="tel"
			bind:element={phone}
			disabled={!captchaSecret}
			placeholder={$_('addLocation.phonePlaceholder')}
		/>

		<div>
			<p class="mb-2 font-semibold">
				{$_('forms.openingHours')}
				<span class="font-normal">{$_('forms.optional')}</span>
			</p>
			<!-- Nested accordion, same idiom as the details expander: the
			     seven-day grid only unfolds for people who care about
			     hours. Collapsing unmounts the editor; the generated
			     string survives in hoursValue and is parsed back into
			     the grid on re-open. -->
			<button
				type="button"
				class="flex items-center gap-1 text-sm font-semibold text-link hover:text-hover focus:outline-link"
				aria-expanded={showHoursEditor}
				aria-controls="opening-hours-editor"
				onclick={() => (showHoursEditor = !showHoursEditor)}
			>
				<Icon
					type="material"
					icon="expand_more"
					w="16"
					h="16"
					class={showHoursEditor ? 'rotate-180' : ''}
				/>
				{$_('addLocation.hoursToggle')}
			</button>
			{#if !showHoursEditor && hoursValue}
				<code class="ml-2 font-mono text-sm text-body dark:text-offwhite">{hoursValue}</code>
			{/if}
			{#if showHoursEditor}
				<div id="opening-hours-editor" class="mt-3">
					<OpeningHoursEditor bind:value={hoursValue} disabled={!captchaSecret} />
				</div>
			{/if}
		</div>

		<div>
			<label for="notes" class="mb-2 block font-semibold"
				>{$_('forms.notes')} <span class="font-normal">{$_('forms.optional')}</span></label
			>
			<textarea
				disabled={!captchaSecret}
				name="notes"
				id="notes"
				placeholder={$_('addLocation.notesPlaceholder')}
				rows="3"
				class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				bind:this={notes}
			></textarea>
		</div>
	</div>

	<TextField
		id="contact"
		name="contact"
		label={$_('forms.contact')}
		optional={identityAttached}
		type="email"
		bind:element={contact}
		disabled={!captchaSecret}
		required={!identityAttached}
		placeholder={$_('addLocation.contactPlaceholder')}
	>
		{#snippet hint()}
			{#if identityAttached && $session}
				<!-- The submission carries the account (verified server-side), so
				     the email is a follow-up channel, not the identity. The chip
				     reveals the shared-device escape hatch: detach the account
				     from this one submission. -->
				<div class="mb-2 flex flex-wrap items-center gap-2">
					<!-- Speaks the app's chip dialect: the filter chips' active
					     pill, the header UserMenu's identity (Nostr avatar or
					     account icon), and the expand_more rotate-on-open
					     disclosure. -->
					<button
						type="button"
						aria-expanded={showDetach}
						onclick={() => (showDetach = !showDetach)}
						class="flex shrink-0 items-center gap-2 rounded-full border border-link bg-link/10 px-3 py-1 text-sm font-semibold whitespace-nowrap text-primary transition-colors focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-1 focus-visible:outline-none dark:border-link dark:text-white dark:focus-visible:ring-offset-dark"
					>
						{#if $session.npub}
							<NostrAvatar npub={$session.npub} size={18} class="h-[18px] w-[18px]" />
						{:else}
							<Icon type="material" icon="account_circle_filled" w="18" h="18" />
						{/if}
						{$_('addLocation.submittingAs', { values: { username: $session.username } })}
						<Icon
							type="material"
							icon="expand_more"
							w="16"
							h="16"
							class={showDetach ? 'rotate-180' : ''}
						/>
					</button>
					{#if showDetach}
						<button
							type="button"
							onclick={() => {
								submitAnonymously = true;
								showDetach = false;
							}}
							class="text-sm font-semibold text-link hover:text-hover focus:outline-link"
						>
							{$_('addLocation.submitAnonymously')}
						</button>
					{/if}
				</div>
				<p class="mb-2 text-justify text-sm">
					{$_('addLocation.contactSignedInHint')}
				</p>
			{:else}
				{#if $session}
					<!-- Detached: the anonymous contract applies, with an undo. -->
					<button
						type="button"
						onclick={() => (submitAnonymously = false)}
						class="mb-2 text-sm font-semibold text-link hover:text-hover focus:outline-link"
					>
						{$_('addLocation.submitAsAccount', { values: { username: $session.username } })}
					</button>
				{/if}
				<p class="mb-2 text-justify text-sm">
					{$_('addLocation.contactDescription')}
				</p>
				{#if !$session}
					<!-- The other #1334 touchpoint: sign in without leaving the
					     form — the auth forms expand in place, typed fields
					     survive, and the chip takes over on success. -->
					<div class="mb-2">
						<button
							type="button"
							aria-expanded={showSignIn}
							onclick={() => (showSignIn = !showSignIn)}
							class="flex items-center gap-1 text-sm font-semibold text-link hover:text-hover focus:outline-link"
						>
							{$_('addLocation.signInPrompt')}
							<Icon
								type="material"
								icon="expand_more"
								w="16"
								h="16"
								class={showSignIn ? 'rotate-180' : ''}
							/>
						</button>
						{#if showSignIn}
							<!-- The auth forms nest inside the location <form>
							     (client-rendered only, so no parser flattening) —
							     their bubbling submit events must not reach
							     submitForm. -->
							<div
								class="mt-3 rounded-2xl border-2 border-input p-4"
								onsubmit={(e) => e.stopPropagation()}
							>
								<LoginForm compact onSuccess={onAuthSuccess} />
								<div class="my-4 flex items-center gap-3">
									<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
									<span class="text-xs text-body dark:text-white/50">
										{$_('login.otherMethods')}
									</span>
									<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
								</div>
								<NostrLoginForm onSuccess={onAuthSuccess} />
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		{/snippet}
	</TextField>

	<div>
		<div class="mb-2 flex items-center space-x-2">
			<label for="captcha" class="font-semibold"
				>{$_('forms.captcha')}
				<span class="font-normal">({$_('forms.captchaCaseSensitive')})</span></label
			>
			{#if captchaSecret}
				<button type="button" onclick={fetchCaptcha}>
					<Icon type="fa" icon="arrows-rotate" w="16" h="16" />
				</button>
			{/if}
		</div>
		<div class="space-y-2">
			<div class="flex items-center justify-center rounded-2xl border-2 border-input py-1">
				{#if isCaptchaLoading}
					<div class="h-[100px] w-[275px] animate-pulse bg-link/50"></div>
				{:else}
					{@html captchaContent}
				{/if}
			</div>
			<input
				disabled={!captchaSecret}
				required
				type="text"
				name="captcha"
				id="captcha"
				placeholder={$_('addLocation.captchaPlaceholder')}
				class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				bind:this={captchaInput}
			/>
		</div>
	</div>

	<input
		type="text"
		name="honey"
		placeholder="A nice pot of honey."
		class="hidden"
		bind:this={honeyInput}
	/>

	<PrimaryButton
		loading={submitting}
		disabled={submitting || !captchaSecret}
		style="w-full py-3 rounded-xl"
	>
		{$_('forms.submitLocation')}
	</PrimaryButton>
</form>
