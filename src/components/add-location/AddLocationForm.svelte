<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import { onMount, tick } from "svelte";
import { get } from "svelte/store";

import FormHelperText from "$components/FormHelperText.svelte";
import type { FormSelectOption } from "$components/form/FormSelect.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import OpeningHoursEditor from "$components/form/OpeningHoursEditor.svelte";
import Icon from "$components/Icon.svelte";
import NostrAvatar from "$components/NostrAvatar.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { trackEvent } from "$lib/analytics";
import { CATEGORIES, CATEGORY_GROUPS } from "$lib/categoryMapping";
import { reverseGeocode } from "$lib/geocoding";
import { _, locale } from "$lib/i18n";
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
	onsuccess: () => void;
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
		.get("/captcha")
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
// Authorization header).
let submitAnonymously = $state(false);
let showDetach = $state(false);
const identityAttached = $derived(!!$session && !submitAnonymously);

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

		axios
			.post(
				"/api/submit-place",
				{
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
				},
				// The endpoint verifies the token and attaches the account to
				// the submission (#1334); no session (or a detached one), no
				// header — anonymous.
				identityAttached && $session
					? { headers: { Authorization: `Bearer ${$session.token}` } }
					: undefined,
			)
			.then(() => {
				onsuccess();
			})
			.catch((error) => {
				if (error.response?.data?.message?.includes("Captcha")) {
					errToast(error.response.data.message);
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
	<div>
		<label for="name" class="mb-2 block font-semibold">{$_('addLocation.nameLabel')}</label>
		<input
			disabled={!captchaSecret}
			type="text"
			name="name"
			id="name"
			placeholder={$_('addLocation.merchantNamePlaceholder')}
			required
			class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
			bind:this={name}
		/>
	</div>

	<div>
		<div class="mb-2">
			<label for="address" class="block font-semibold">
				{$_('forms.address')}
				{#if !addressRequired}
					<span class="font-normal">{$_('forms.optional')}</span>
				{/if}
			</label>
			<FormHelperText text={$_('addLocation.addressSuggestedHint')} />
		</div>
		<input
			disabled={!captchaSecret}
			required={addressRequired}
			type="text"
			name="address"
			id="address"
			placeholder={addressPending
				? $_('addLocation.addressLookupPending')
				: $_('addLocation.addressPlaceholder')}
			class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
			bind:this={address}
		/>
	</div>

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
			class="text-sm font-semibold text-link hover:text-hover focus:outline-link"
			aria-expanded={showMoreDetails}
			onclick={() => (showMoreDetails = !showMoreDetails)}
		>
			{showMoreDetails ? '▾' : '▸'}
			{$_('addLocation.moreDetailsToggle')}
		</button>
	</div>

	<div class="space-y-5" class:hidden={!showMoreDetails}>
		<div>
			<div>
				<label for="name-en" class="mb-2 block font-semibold">
					{$_('addLocation.nameEnLabel')}
					<span class="font-normal">{$_('forms.optional')}</span>
				</label>
				<FormHelperText text={$_('addLocation.nameEnTooltip')} />
			</div>
			<input
				disabled={!captchaSecret}
				type="text"
				name="nameEn"
				id="name-en"
				placeholder={$_('addLocation.merchantEnglishNamePlaceholder')}
				class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				bind:this={nameEn}
			/>
		</div>

		<div>
			<label for="website" class="mb-2 block font-semibold"
				>{$_('forms.website')} <span class="font-normal">{$_('forms.optional')}</span></label
			>
			<input
				disabled={!captchaSecret}
				type="url"
				name="website"
				id="website"
				placeholder={$_('addLocation.websitePlaceholder')}
				class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				bind:this={website}
			/>
		</div>

		<div>
			<label for="phone" class="mb-2 block font-semibold"
				>{$_('forms.phone')} <span class="font-normal">{$_('forms.optional')}</span></label
			>
			<input
				disabled={!captchaSecret}
				type="tel"
				name="phone"
				id="phone"
				placeholder={$_('addLocation.phonePlaceholder')}
				class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				bind:this={phone}
			/>
		</div>

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
				class="text-sm font-semibold text-link hover:text-hover focus:outline-link"
				aria-expanded={showHoursEditor}
				aria-controls="opening-hours-editor"
				onclick={() => (showHoursEditor = !showHoursEditor)}
			>
				{showHoursEditor ? '▾' : '▸'}
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

	<div>
		<label for="contact" class="mb-2 block font-semibold">
			{$_('forms.contact')}
			{#if identityAttached}
				<span class="font-normal">{$_('forms.optional')}</span>
			{/if}
		</label>
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
		{/if}
		<input
			disabled={!captchaSecret}
			required={!identityAttached}
			type="email"
			name="contact"
			id="contact"
			placeholder={$_('addLocation.contactPlaceholder')}
			class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
			bind:this={contact}
		/>
	</div>

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
