<script lang="ts">
import type { AnyFieldApi } from "@tanstack/svelte-form";
import { createForm } from "@tanstack/svelte-form";
import axios from "axios";
import { onMount, tick, untrack } from "svelte";
import { get } from "svelte/store";

import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";
import FormHelperText from "$components/FormHelperText.svelte";
import CaptchaField from "$components/form/CaptchaField.svelte";
import FieldError from "$components/form/FieldError.svelte";
import type { FormSelectOption } from "$components/form/FormSelect.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import OpeningHoursEditor from "$components/form/OpeningHoursEditor.svelte";
import TextArea from "$components/form/TextArea.svelte";
import TextField from "$components/form/TextField.svelte";
import Icon from "$components/Icon.svelte";
import NostrAvatar from "$components/NostrAvatar.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import {
	DETAILS_FIELDS,
	normalizeWebsite,
	validateDetails,
} from "$lib/addLocationValidation";
import { trackEvent } from "$lib/analytics";
import { API_BASE } from "$lib/api-base";
import { CATEGORIES, CATEGORY_GROUPS } from "$lib/categoryMapping";
import { fieldBorderClasses } from "$lib/fieldStyles";
import { reverseGeocode } from "$lib/geocoding";
import { _, locale } from "$lib/i18n";
import type { PaymentMethod } from "$lib/map/paymentMethodFilter";
import { PAYMENT_METHODS } from "$lib/map/paymentMethodFilter";
import { fetchProfile } from "$lib/nostrProfile";
import { formatPinCoords } from "$lib/placementMode";
import type {
	SubmitPlaceRequest,
	SubmitPlaceResponse,
} from "$lib/placeSubmission";
import { buildPlaceSubmissionArgs } from "$lib/placeSubmission";
import { fieldError, inputProps, ruleValidation } from "$lib/ruleValidation";
import { session } from "$lib/session";
import { theme } from "$lib/theme";
import { errToast } from "$lib/utils";

import type { PostPlaceSubmissionResponse } from "$types/btcmap-api/PostPlaceSubmissionResponse";

// The add-location details form, extracted from the /add-location page so
// the map's placement side-panel can host the same component (#1134). The
// pin always comes from placement mode — hosts guarantee valid coords —
// so the form is details-first by construction. The host owns the success
// state; on a completed submission the form calls `onsuccess`.
//
// Two steps (#1341): the edit step collects the fields, the review step
// shows "here's what will be published" and owns the captcha — so the
// inputs are usable immediately instead of waiting on the captcha fetch,
// and prefill junk (suggested address, generated hours) gets one explicit
// look before it reaches the volunteer queue. Each step is a TanStack
// form (#1420, with the rules and semantics of #1404 via ruleValidation):
// the edit step's fields, and the review step's captcha answer. The edit
// fields stay mounted and are only CSS-hidden during review, so the
// expanders and the hours editor keep their state across the round trip.
type Props = {
	coords: { lat: number; long: number };
	// On a completed submission. `attributed` = it went out with a verified
	// account attached (the host's success screen picks its one ask by
	// it); `name` titles that screen.
	onsuccess: (result: { attributed: boolean; name: string }) => void;
	// Fires on edit↔review transitions so the host can adapt its chrome
	// (the header's step label, and the edit-only panel content).
	onstepchange?: (step: "edit" | "review") => void;
	// Hand the pin back to placement mode (#1425). It lives under the
	// address because that is the pin in readable form: doubt about a
	// position arrives while reading a street name, not a coordinate.
	onmovepin: () => void;
	// True while the host re-places the pin — this form is hidden, not
	// unmounted, which is what lets the "keeps your answers" clause be
	// true. Focus returns to Move pin when it clears.
	hidden?: boolean;
};
let {
	coords,
	onsuccess,
	onstepchange,
	onmovepin,
	hidden = false,
}: Props = $props();

let step = $state<"edit" | "review">("edit");

let movePinButton = $state<HTMLButtonElement>();
let wasHidden = false;
$effect(() => {
	if (wasHidden && !hidden) movePinButton?.focus();
	wasHidden = hidden;
});

// The captcha is fetched when the review step opens, not on mount — the
// edit step needs none of it, and abandoners cost no fetches.
let captchaContent = $state("");
let isCaptchaLoading = $state(false);
let captchaSecret = $state<string>();
let captchaInput = $state<HTMLInputElement>();
let honeyInput = $state<HTMLInputElement>();

const fetchCaptcha = () => {
	isCaptchaLoading = true;
	// A new image voids the old secret and whatever was typed for it: clear
	// both, so Submit stays disabled until the replacement arrives.
	captchaSecret = undefined;
	reviewForm.reset();
	review.reset();
	axios
		.get<{ captcha: string; captchaSecret: string }>("/captcha")
		.then((response) => {
			captchaSecret = response.data.captchaSecret;
			captchaContent = response.data.captcha;
		})
		.catch((error) => {
			errToast(get(_)("errors.captchaFetch"));
			console.error(error);
		})
		.finally(() => {
			isCaptchaLoading = false;
		});
};

let nameInput = $state<HTMLInputElement>();
let addressInput = $state<HTMLInputElement>();
let showMoreDetails = $state(false);

// Address suggestion from the pin (#1315). Re-runs whenever the pin
// moves — the host's Move pin, or history navigation between two arrivals
// keeps this instance alive with new coords. A fulfilled suggestion flips
// the field to required, so it can be corrected but not blanked out; a
// miss leaves it optional, exactly the pre-suggestion behavior.
let addressPending = $state(true);
let addressRequired = $state(false);
// What the lookup last wrote — tells an untouched suggestion apart from
// user-typed text when the pin moves, and gates a superseded lookup.
let lastSuggested = "";
let lookupToken = 0;
// Coords of the last initiated lookup: a review→edit bounce with an
// unmoved pin must not re-fire it — a flaky miss on the re-run would
// blank an already-accepted suggestion, and the prefill funnel event
// would double-count.
let lastLookupLat: number | null = null;
let lastLookupLong: number | null = null;

// What the field is allowed to say about the pin (#1425). While a lookup
// is in flight it says nothing: naming an outcome before one exists is
// how the old always-on hint came to claim a suggestion over an empty
// box. Afterwards `addressRequired` *is* the hit — OSM only locks the
// field when it knew an address here.
const addressHintKey = $derived(
	addressPending
		? undefined
		: addressRequired
			? "addLocation.addressSuggestedHint"
			: "addLocation.addressNoneFoundHint",
);

const suggestAddress = async (lat: number, long: number) => {
	if (lat === lastLookupLat && long === lastLookupLong) return;
	lastLookupLat = lat;
	lastLookupLong = long;
	const token = ++lookupToken;
	addressPending = true;
	const suggestion = await reverseGeocode(lat, long, get(locale) ?? "en");
	// The pin moved again while this lookup was in flight — drop it.
	if (token !== lookupToken) return;
	// Landed mid-review: drop it (mutating the hidden address field could
	// leave it required-but-empty), but forget the attempt so the return
	// trip to edit retries these coords.
	if (step !== "edit") {
		lastLookupLat = null;
		lastLookupLong = null;
		return;
	}
	addressPending = false;
	trackEvent("add_place_address_prefill", {
		outcome: suggestion ? "hit" : "miss",
	});
	// Required on every hit — OSM knows an address here, so blank is never
	// right. The value guard only replaces an empty field or the previous
	// pin's untouched suggestion; text the user typed (or autofill wrote)
	// stays put.
	const current = detailsForm.state.values.address;
	if (suggestion) {
		addressRequired = true;
		if (!current || current === lastSuggested) {
			detailsForm.setFieldValue("address", suggestion);
		}
		lastSuggested = suggestion;
	} else {
		addressRequired = false;
		if (current === lastSuggested) {
			detailsForm.setFieldValue("address", "");
		}
		lastSuggested = "";
	}
	// Requiredness isn't a field value: a flagged address (Move pin after a
	// rejected Review) re-checks against it too.
	detailsForm.validate("change");
};

$effect(() => {
	// Mount included — coords and step are the only tracked reads
	// (everything else sits behind the await). Paused during review: a
	// lookup landing then could flip the hidden address field to
	// required-but-empty, which would block the confirm submit invisibly.
	// Returning to edit re-runs this and refreshes the suggestion.
	if (step !== "edit") return;
	suggestAddress(coords.lat, coords.long);
});

let categorySelectElement = $state<HTMLSelectElement>();
let categoryOtherElement = $state<HTMLInputElement>();

// Map taxonomy minus the "all" pseudo-bucket, plus the Other escape
// hatch — labels verbatim from the map UI.
const categoryOptions: FormSelectOption[] = CATEGORIES.filter(
	(key) => key !== "all",
).map((key) => ({ value: key, label: CATEGORY_GROUPS[key].label }));

let onchainBox = $state<HTMLInputElement>();
let websiteInput = $state<HTMLInputElement>();
// Outside the form: the day-grid editor binds the OSM opening_hours string
// it generates, and nothing validates it.
let hoursValue = $state("");
let showHoursEditor = $state(false);
let contactInput = $state<HTMLInputElement>();
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

// For Nostr-linked accounts, show the profile's display name instead of
// the auto-generated API username — the header's UserMenu idiom.
// fetchProfile caches, and the npub guard keeps it to one fetch and
// drops stale results. Rendered as text, so relay-sourced names stay
// escaped.
let nostrName = $state<string | null>(null);
let loadedNpub: string | null = null;
$effect(() => {
	const npub = $session?.npub ?? null;
	if (npub === loadedNpub) return;
	loadedNpub = npub;
	nostrName = null;
	if (npub) {
		fetchProfile(npub).then((profile) => {
			if (loadedNpub === npub) {
				nostrName = profile?.displayName || profile?.name || null;
			}
		});
	}
});
const displayName = $derived(nostrName ?? $session?.username ?? "");

const onAuthSuccess = () => {
	// The forms set the session store themselves — collapse and let the
	// chip take over (a fresh login also clears a previous detach).
	showSignIn = false;
	submitAnonymously = false;
};

// Whether the contact email is required flips with the identity (sign-in,
// detach, undo), which isn't a field value: re-check a flagged contact
// against it.
$effect(() => {
	void identityAttached;
	untrack(() => detailsForm.validate("change"));
});

type DetailsValues = {
	name: string;
	nameEn: string;
	address: string;
	category: string;
	categoryOther: string;
	methods: PaymentMethod[];
	website: string;
	phone: string;
	notes: string;
	contact: string;
};

// The edit step's rules (#1404); the category's error belongs to the
// select for a missing pick, to the Other field for an empty description.
const details = ruleValidation({
	order: DETAILS_FIELDS,
	validate: (value: DetailsValues) =>
		validateDetails({
			...value,
			addressRequired,
			contactRequired: !identityAttached,
		}),
	controls: {
		name: () => nameInput,
		address: () => addressInput,
		category: (rule) =>
			rule === "otherRequired" ? categoryOtherElement : categorySelectElement,
		methods: () => onchainBox,
		website: () => websiteInput,
		contact: () => contactInput,
	},
});

const detailsForm = createForm(() => ({
	defaultValues: {
		name: "",
		nameEn: "",
		address: "",
		category: "",
		categoryOther: "",
		methods: [],
		website: "",
		phone: "",
		notes: "",
		contact: "",
	} as DetailsValues,
	...details.options,
	onSubmitInvalid: ({ formApi }) => {
		// A marked website inside the collapsed details would be hidden
		// (display:none) — and couldn't take focus.
		if (formApi.getFieldMeta("website")?.errors.length) {
			showMoreDetails = true;
		}
		details.options.onSubmitInvalid();
	},
	onSubmit: ({ value }) => {
		preview = collectPreview(value);
		step = "review";
		onstepchange?.("review");
		trackEvent("add_place_review_enter");
		// Captcha only guards the anonymous path (#1374) — a signed-in
		// submission authenticates with the account token instead. First
		// entry fetches; bouncing edit↔review keeps the loaded one (the
		// refresh button covers an expired image).
		if (!identityAttached && !captchaSecret && !isCaptchaLoading) {
			fetchCaptcha();
		}
		scrollToTop();
	},
}));
const detailsValues = detailsForm.useSelector((state) => state.values);

const toggleMethod = (
	field: AnyFieldApi,
	method: PaymentMethod,
	on: boolean,
) => {
	const methods: PaymentMethod[] = field.state.value;
	field.handleChange(
		on ? [...methods, method] : methods.filter((m) => m !== method),
	);
};

// The review step's one field: the anonymous path's captcha answer. A
// wrong answer is the server's call and stays a toast.
const review = ruleValidation({
	order: ["captcha"],
	validate: (value: { captcha: string }): { captcha?: "required" } =>
		identityAttached || value.captcha.trim() ? {} : { captcha: "required" },
	controls: { captcha: () => captchaInput },
});

const reviewForm = createForm(() => ({
	defaultValues: { captcha: "" },
	...review.options,
	onSubmit: ({ value }) => submitPreview(value.captcha),
}));

// The review step's snapshot, taken on entry. The hidden edit fields
// can't change while review is open, and neither can the pin — the host
// offers Move pin on the edit step only. This is exactly what the
// confirm submit sends; re-positioning means going back to edit (which
// re-snapshots on the next review).
type SubmissionPreview = {
	lat: number;
	long: number;
	name: string;
	nameEn: string;
	address: string;
	category: string;
	methods: PaymentMethod[];
	website: string;
	phone: string;
	hours: string;
	notes: string;
	contact: string;
};
let preview = $state<SubmissionPreview | null>(null);
// The taxonomy label the picker showed; free-text Other is its own
// label. Derived from the select, which is frozen (hidden) during
// review.
const previewCategoryLabel = $derived(
	categoryOptions.find(
		(option) => option.value === detailsValues.current.category,
	)?.label ??
		preview?.category ??
		"",
);

// Runs after validateDetails passed, so the website normalizes.
const collectPreview = (value: DetailsValues): SubmissionPreview => ({
	lat: coords.lat,
	long: coords.long,
	name: value.name,
	nameEn: value.nameEn,
	address: value.address,
	category:
		value.category === "Other" ? value.categoryOther.trim() : value.category,
	// In the map's order, whatever order they were ticked in.
	methods: PAYMENT_METHODS.filter((method) => value.methods.includes(method)),
	// A bare domain is published with https:// in front.
	website: normalizeWebsite(value.website) ?? "",
	phone: value.phone,
	hours: hoursValue,
	notes: value.notes,
	// A typed email survives an attach/detach round trip in the form, but
	// an attached submission has no contact to send.
	contact: identityAttached ? "" : value.contact,
});

let formElement = $state<HTMLFormElement>();
const scrollToTop = () => {
	tick().then(() => formElement?.scrollIntoView({ block: "start" }));
};

const backToEdit = () => {
	reviewForm.reset();
	review.reset();
	step = "edit";
	onstepchange?.("edit");
	trackEvent("add_place_review_back");
	scrollToTop();
};

// The form's one submit, for whichever step is showing: Review on the edit
// step, the confirm on the review step.
const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (step === "edit") {
		details.submit(detailsForm);
	} else if (preview) {
		review.submit(reviewForm);
	}
};

const submitPreview = (captchaAnswer: string) => {
	if (!preview) return;
	const { name: submittedName } = preview;
	submitting = true;

	// The authorized fork (#1374, per #1348): signed in goes straight to
	// the REST API under the user's own token — same endpoint as the
	// Android form; anonymous keeps the captcha-guarded server proxy
	// (which holds the import token).
	if (identityAttached && $session) {
		axios
			.post<PostPlaceSubmissionResponse>(
				`${API_BASE}/v4/place-submissions`,
				buildPlaceSubmissionArgs(preview),
				{ headers: { Authorization: `Bearer ${$session.token.trim()}` } },
			)
			.then(() => {
				trackEvent("add_place_submit_success");
				onsuccess({ attributed: true, name: submittedName });
			})
			.catch((error) => {
				errToast(get(_)("errors.formSubmission"));
				console.error(error);
				submitting = false;
			});
		return;
	}

	// The reviewed snapshot goes out verbatim — only the captcha answer
	// and the honeypot are read live.
	const payload: SubmitPlaceRequest = {
		captchaSecret,
		captchaTest: captchaAnswer,
		honey: honeyInput?.value,
		...preview,
	};

	axios
		.post<SubmitPlaceResponse>("/api/submit-place", payload)
		.then(() => {
			trackEvent("add_place_submit_success");
			onsuccess({ attributed: false, name: submittedName });
		})
		.catch((error) => {
			// Our endpoint's 4xx messages are written for users (captcha,
			// missing contact, …) — show them.
			const message = error.response?.data?.message;
			if (message && error.response.status < 500) {
				errToast(message);
			} else {
				errToast(get(_)("errors.formSubmission"));
			}
			console.error(error);
			submitting = false;
			// The server burns a captcha on its first correct answer, before
			// the submission itself can fail (#1401) — resending it could only
			// come back "already used". Hand the retry a fresh one.
			fetchCaptcha();
		});
};

onMount(() => {
	// Keyboard-first on desktop only: popping the on-screen keyboard
	// on mobile would cover the confirmation the user just landed on.
	if (window.matchMedia("(pointer: fine)").matches) {
		nameInput?.focus();
	}
});
</script>

<!-- scroll-mt clears the shell's sticky header when the step switch
     scrolls the form back into view — sized for the header with its
     step label and bar (~78px), or the review step's back link lands
     under it. `novalidate`: the form reports its own errors inline
     (#1404) instead of the browser's bubbles. -->
<form
	bind:this={formElement}
	onsubmit={submitForm}
	novalidate
	class="w-full scroll-mt-24 space-y-5 text-primary dark:text-white"
>
	<!-- Edit step — CSS-hidden during review (see the header comment). -->
	<div class="space-y-5" class:hidden={step === 'review'}>
		<detailsForm.Field name="name">
			{#snippet children(field)}
				<TextField
					id="name"
					name="name"
					label={$_('addLocation.nameLabel')}
					placeholder={$_('addLocation.merchantNamePlaceholder')}
					required
					error={fieldError(field) && $_('addLocation.nameRequired')}
					{...inputProps(field)}
					bind:element={nameInput}
				/>
			{/snippet}
		</detailsForm.Field>

		<detailsForm.Field name="address">
			{#snippet children(field)}
				<TextField
					id="address"
					name="address"
					label={$_('forms.address')}
					optional={!addressRequired}
					required={addressRequired}
					error={fieldError(field) && $_('addLocation.addressRequired')}
					placeholder={addressPending
						? $_('addLocation.addressLookupPending')
						: $_('addLocation.addressPlaceholder')}
					aria-describedby={addressHintKey ? 'address-hint' : undefined}
					{...inputProps(field)}
					bind:element={addressInput}
				>
					<!-- Below the input, not above it: the hint reports on what
					     the field now holds, and the action to fix it follows
					     the doubt rather than preceding it (#1425). -->
					{#snippet children()}
						{#if addressHintKey}
							<FormHelperText
								id="address-hint"
								text={$_(addressHintKey)}
								icon={addressRequired ? undefined : 'info_outline'}
							/>
						{/if}
						<!-- 34px so it sits under its field instead of competing
						     with the form's filled primary; the transparent
						     ::after keeps the tap target at 44px. -->
						<button
							bind:this={movePinButton}
							type="button"
							onclick={onmovepin}
							class="relative mt-2.5 inline-flex h-[34px] items-center gap-1.5 rounded-full border border-link px-3 text-[13px] font-semibold whitespace-nowrap text-link transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:bg-link hover:text-white focus:outline-link"
						>
							<Icon type="material" icon="my_location" w="15" h="15" />
							{$_('addLocation.movePin')}
						</button>
					{/snippet}
				</TextField>
			{/snippet}
		</detailsForm.Field>

		<detailsForm.Field name="category">
			{#snippet children(field)}
				{@const code = fieldError(field)}
				<div>
					<label id="category-label" for="category" class="mb-2 block font-semibold"
						>{$_('forms.category')}</label
					>
					{#if code === 'required'}
						<FieldError id="category-error" message={$_('addLocation.categoryRequired')} />
					{/if}
					<FormSelect
						id="category"
						name="category"
						required
						bind:element={categorySelectElement}
						invalid={code === 'required'}
						ariaDescribedby={code === 'required' ? 'category-error' : undefined}
						options={[
							{ value: '', label: $_('addLocation.categorySelectPlaceholder') },
							...categoryOptions,
							{ value: 'Other', label: $_('addLocation.categoryOtherOption') }
						]}
						value={field.state.value}
						onchange={async (e) => {
							const picked = e.currentTarget.value;
							field.handleChange(picked);
							if (picked === 'Other') {
								await tick();
								categoryOtherElement?.focus();
							}
						}}
					/>
					{#if field.state.value === 'Other'}
						<!-- The Other field has no label of its own: it borrows the
						     Category label as its name, and its message sits right
						     above it, below the (valid) select. -->
						{#if code === 'otherRequired'}
							<FieldError
								id="category-other-error"
								message={$_('addLocation.categoryOtherRequired')}
								class="mt-2"
							/>
						{/if}
						<detailsForm.Field name="categoryOther">
							{#snippet children(other)}
								<input
									required
									type="text"
									name="category-other"
									placeholder={$_('addLocation.categoryPlaceholder')}
									aria-labelledby="category-label"
									aria-invalid={code === 'otherRequired' ? 'true' : undefined}
									aria-describedby={code === 'otherRequired' ? 'category-other-error' : undefined}
									class="mt-2 w-full rounded-2xl border-2 {fieldBorderClasses(
										code === 'otherRequired'
									)} p-3 transition-all disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
									{...inputProps(other)}
									bind:this={categoryOtherElement}
								/>
							{/snippet}
						</detailsForm.Field>
					{/if}
				</div>
			{/snippet}
		</detailsForm.Field>

		<!-- The payment rule is stated where the choice is made: a question
		     as the label, the requirement under it, and a rejected Review
		     turns the border and that same line to error — no toast. A div
		     group rather than a fieldset: a bordered fieldset draws its
		     legend into the border line. The rule describes each checkbox,
		     not the group: a group's description isn't inherited by the
		     control that takes focus, and several screen readers skip it
		     on entry — and on both, JAWS would read the rule twice. -->
		<detailsForm.Field name="methods">
			{#snippet children(field)}
		{@const methodsInvalid = !!fieldError(field)}
		<div
			role="group"
			aria-labelledby="payment-methods-question"
			class="rounded-2xl border-2 p-3.5 {methodsInvalid
				? 'border-error'
				: 'border-input'}"
		>
			<p id="payment-methods-question" class="font-semibold">
				{$_('addLocation.paymentMethodsQuestion')}
			</p>
			<p
				id="payment-methods-requirement"
				class="mt-1 text-sm {methodsInvalid
					? 'font-semibold text-error'
					: 'text-body dark:text-offwhite'}"
			>
				{methodsInvalid
					? $_('addLocation.paymentMethodsRequirementError')
					: $_('addLocation.paymentMethodsRequirement')}
			</p>
			<div class="mt-3 space-y-3.5">
				<div class="flex items-center gap-2">
					<input
						class="h-4 w-4 shrink-0 accent-link"
						aria-describedby="payment-methods-requirement"
						aria-invalid={methodsInvalid ? 'true' : undefined}
						type="checkbox"
						name="onchain"
						id="onchain"
						checked={field.state.value.includes('onchain')}
						onchange={(e) => toggleMethod(field, 'onchain', e.currentTarget.checked)}
						bind:this={onchainBox}
					/>
					<label for="onchain" class="flex cursor-pointer items-center gap-2">
						{#if typeof window !== 'undefined'}
							<img
								src={$theme === 'dark'
									? '/icons/btc-highlight-dark.svg'
									: '/icons/btc-primary.svg'}
								alt=""
								class="h-[18px] w-[18px]"
							/>
						{/if}
						{$_('addLocation.onchainLabel')}
					</label>
				</div>
				<div class="flex items-center gap-2">
					<input
						class="h-4 w-4 shrink-0 accent-link"
						aria-describedby="payment-methods-requirement"
						aria-invalid={methodsInvalid ? 'true' : undefined}
						type="checkbox"
						name="lightning"
						id="lightning"
						checked={field.state.value.includes('lightning')}
						onchange={(e) => toggleMethod(field, 'lightning', e.currentTarget.checked)}
					/>
					<label for="lightning" class="flex cursor-pointer items-center gap-2">
						{#if typeof window !== 'undefined'}
							<img
								src={$theme === 'dark'
									? '/icons/ln-highlight-dark.svg'
									: '/icons/ln-primary.svg'}
								alt=""
								class="h-[18px] w-[18px]"
							/>
						{/if}
						{$_('addLocation.lightningLabel')}
					</label>
				</div>
				<div class="flex items-center gap-2">
					<input
						class="h-4 w-4 shrink-0 accent-link"
						aria-describedby="payment-methods-requirement"
						aria-invalid={methodsInvalid ? 'true' : undefined}
						type="checkbox"
						name="nfc"
						id="nfc"
						checked={field.state.value.includes('nfc')}
						onchange={(e) => toggleMethod(field, 'nfc', e.currentTarget.checked)}
					/>
					<label for="nfc" class="flex cursor-pointer items-center gap-2">
						{#if typeof window !== 'undefined'}
							<img
								src={$theme === 'dark'
									? '/icons/nfc-highlight-dark.svg'
									: '/icons/nfc-primary.svg'}
								alt=""
								class="h-[18px] w-[18px]"
							/>
						{/if}
						{$_('addLocation.nfcLabel')}
					</label>
				</div>
			</div>
		</div>
			{/snippet}
		</detailsForm.Field>

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
			<detailsForm.Field name="nameEn">
				{#snippet children(field)}
					<TextField
						id="name-en"
						name="nameEn"
						label={$_('addLocation.nameEnLabel')}
						optional
						placeholder={$_('addLocation.merchantEnglishNamePlaceholder')}
						{...inputProps(field)}
					>
						{#snippet hint()}
							<FormHelperText text={$_('addLocation.nameEnTooltip')} />
						{/snippet}
					</TextField>
				{/snippet}
			</detailsForm.Field>

			<detailsForm.Field name="website">
				{#snippet children(field)}
					<TextField
						id="website"
						name="website"
						label={$_('forms.website')}
						optional
						type="url"
						error={fieldError(field) && $_('addLocation.websiteInvalid')}
						placeholder={$_('addLocation.websitePlaceholder')}
						{...inputProps(field)}
						bind:element={websiteInput}
					/>
				{/snippet}
			</detailsForm.Field>

			<detailsForm.Field name="phone">
				{#snippet children(field)}
					<TextField
						id="phone"
						name="phone"
						label={$_('forms.phone')}
						optional
						type="tel"
						placeholder={$_('addLocation.phonePlaceholder')}
						{...inputProps(field)}
					/>
				{/snippet}
			</detailsForm.Field>

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
						<OpeningHoursEditor bind:value={hoursValue} />
					</div>
				{/if}
			</div>

			<detailsForm.Field name="notes">
				{#snippet children(field)}
					<TextArea
						id="notes"
						name="notes"
						label={$_('forms.notes')}
						optional
						placeholder={$_('addLocation.notesPlaceholder')}
						{...inputProps(field)}
					/>
				{/snippet}
			</detailsForm.Field>
		</div>

		{#if identityAttached && $session}
			<!-- Signed in (#1374): the submission goes to the API under the
			     account — no ticket, no contact email to collect. The chip
			     keeps the shared-device escape hatch: detach the account
			     from this one submission. -->
			<div>
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
						{$_('addLocation.submittingAs', { values: { username: displayName } })}
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
				<p class="text-justify text-sm">
					{$_('addLocation.contactSignedInHint')}
				</p>
			</div>
		{:else}
			<!-- The anonymous contract: a required contact email. It isn't
			     rendered while an account is attached, and an attached
			     submission sends none (collectPreview). -->
			<detailsForm.Field name="contact">
			{#snippet children(field)}
			{@const code = fieldError(field)}
			<TextField
				id="contact"
				name="contact"
				label={$_('forms.contact')}
				type="email"
				required
				error={code === 'invalid'
					? $_('addLocation.contactInvalid')
					: code && $_('addLocation.contactRequired')}
				placeholder={$_('addLocation.contactPlaceholder')}
				{...inputProps(field)}
				bind:element={contactInput}
			>
				{#snippet hint()}
					{#if $session}
						<!-- Detached: the anonymous contract applies, with an undo. -->
						<button
							type="button"
							onclick={() => (submitAnonymously = false)}
							class="mb-2 text-sm font-semibold text-link hover:text-hover focus:outline-link"
						>
							{$_('addLocation.submitAsAccount', { values: { username: displayName } })}
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
				{/snippet}
			</TextField>
			{/snippet}
			</detailsForm.Field>
		{/if}

		<PrimaryButton style="w-full py-3 rounded-xl">
			{$_('addLocation.reviewButton')}
		</PrimaryButton>
	</div>

	{#if step === 'review' && preview}
		{#snippet row(label: string, value: string)}
			{#if value}
				<div>
					<dt class="text-sm font-semibold">{label}</dt>
					<dd class="break-words whitespace-pre-wrap">{value}</dd>
				</div>
			{/if}
		{/snippet}
		<div class="space-y-5">
			<!-- Back sits at the top, under the header's step label, so back
			     and forward aren't at opposite ends of a long scroll. -->
			<button
				type="button"
				onclick={backToEdit}
				class="inline-flex items-center gap-1 text-sm font-semibold text-link hover:text-hover focus:outline-link"
			>
				<Icon type="material" icon="chevron_left" w="18" h="18" />
				{$_('addLocation.reviewBackButton')}
			</button>
			<div>
				<h3 class="text-lg font-semibold">{$_('addLocation.reviewTitle')}</h3>
				<p class="text-sm text-body dark:text-offwhite">
					{$_('addLocation.reviewHint')}
				</p>
			</div>

			<dl class="space-y-3 rounded-2xl border-2 border-input p-4">
				{@render row($_('addLocation.reviewName'), preview.name)}
				{@render row($_('forms.address'), preview.address)}
				{@render row(
					$_('addLocation.reviewPosition'),
					formatPinCoords(preview.lat, preview.long)
				)}
				{@render row($_('forms.category'), previewCategoryLabel)}
				{@render row(
					$_('addLocation.reviewPayments'),
					preview.methods.map((m) => $_(`addLocation.${m}Label`)).join(', ')
				)}
				{@render row($_('addLocation.reviewNameEn'), preview.nameEn)}
				{@render row($_('forms.website'), preview.website)}
				{@render row($_('forms.phone'), preview.phone)}
				{@render row($_('forms.openingHours'), preview.hours)}
				{@render row($_('forms.notes'), preview.notes)}
				{@render row($_('forms.contact'), preview.contact)}
				{@render row(
					$_('addLocation.reviewIdentity'),
					identityAttached ? displayName : $_('addLocation.reviewAnonymous')
				)}
			</dl>

			<!-- The captcha guards the anonymous path only (#1374): a
			     signed-in submission authenticates with the account token. -->
			{#if !identityAttached}
				<reviewForm.Field name="captcha">
					{#snippet children(field)}
						<CaptchaField
							content={captchaContent}
							loading={isCaptchaLoading}
							onrefresh={fetchCaptcha}
							disabled={!captchaSecret}
							invalid={!!fieldError(field)}
							{...inputProps(field)}
							bind:element={captchaInput}
						/>
					{/snippet}
				</reviewForm.Field>
			{/if}

			<PrimaryButton
				loading={submitting}
				disabled={submitting || (!identityAttached && !captchaSecret)}
				style="w-full py-3 rounded-xl"
			>
				{$_('forms.submitLocation')}
			</PrimaryButton>
		</div>
	{/if}

	<input
		type="text"
		name="honey"
		placeholder="A nice pot of honey."
		class="hidden"
		bind:this={honeyInput}
	/>
</form>
