<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import { onMount, tick } from "svelte";
import { get } from "svelte/store";

import FormHelperText from "$components/FormHelperText.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import type { FormSelectOption } from "$components/form/FormSelect.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import Icon from "$components/Icon.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PlacementPinIcon from "$components/PlacementPinIcon.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import StaticMapPreview from "$components/StaticMapPreview.svelte";
import { CATEGORIES, CATEGORY_GROUPS } from "$lib/categoryMapping";
import { CLUSTERING_DISABLED_ZOOM } from "$lib/constants";
import { _ } from "$lib/i18n";
import { buildPlacementUrl, placementEntryUrl } from "$lib/placementMode";
import { theme } from "$lib/theme";
import { errToast } from "$lib/utils";

import type { PageData } from "./$types";
import { browser } from "$app/environment";
import { goto } from "$app/navigation";

// The pin always comes from the map's placement mode — the route's load
// guard redirects anything without valid ?lat&long there — so the page is
// details-first by construction (SSR included, no hydration flash).
export let data: PageData;
$: coords = data.coords;
$: adjustUrl = buildPlacementUrl(coords.lat, coords.long);
// One-shot desktop nicety: hand focus to the name field once the inputs
// unlock (the captcha gates them via `disabled`).
let nameFocusPending = false;
$: if (nameFocusPending && captchaSecret && name) {
	nameFocusPending = false;
	// Wait out the same render that flips the input's `disabled` off —
	// focusing a still-disabled element is a silent no-op.
	tick().then(() => name?.focus());
}

let captchaContent = "";
let isCaptchaLoading = true;
let captchaSecret: string;
let captchaInput: HTMLInputElement;
let honeyInput: HTMLInputElement;

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

let name: HTMLInputElement;
let nameEn: HTMLInputElement;
let address: HTMLInputElement;
let showMoreDetails = false;

let categorySelect: string | undefined;
let categoryOther: string | undefined;
let categoryOtherElement: HTMLInputElement;

// Map taxonomy minus the "all" pseudo-bucket, plus the Other escape
// hatch — labels verbatim from the map UI.
const categoryOptions: FormSelectOption[] = CATEGORIES.filter(
	(key) => key !== "all",
).map((key) => ({ value: key, label: CATEGORY_GROUPS[key].label }));

let methods: ("onchain" | "lightning" | "nfc")[] = [];
let onchain: HTMLInputElement;
let lightning: HTMLInputElement;
let nfc: HTMLInputElement;
let website: HTMLInputElement;
let phone: HTMLInputElement;
let hours: HTMLInputElement;
let notes: HTMLTextAreaElement;
let contact: HTMLInputElement;
let source: "Business Owner" | "Customer" | "Other" | undefined;
let sourceOther: string | undefined;
let sourceOtherElement: HTMLTextAreaElement;
let noMethodSelected = false;
let submitted = false;
let submitting = false;

const handleCheckboxClick = () => {
	noMethodSelected = false;
};

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (categorySelect === "Other" && !(categoryOther ?? "").trim()) {
		errToast(get(_)("addLocation.categoryOtherRequired"));
		categoryOtherElement.focus();
		return;
	}
	if (!onchain.checked && !lightning.checked && !nfc.checked) {
		noMethodSelected = true;
		errToast(get(_)("errors.noPaymentMethod"));
	} else {
		submitting = true;
		if (onchain.checked) {
			methods.push("onchain");
		}
		if (lightning.checked) {
			methods.push("lightning");
		}
		if (nfc.checked) {
			methods.push("nfc");
		}

		axios
			.post("/api/submit-place", {
				captchaSecret,
				captchaTest: captchaInput.value,
				honey: honeyInput.value,
				name: name.value,
				nameEn: nameEn.value,
				address: address.value,
				lat: coords.lat,
				long: coords.long,
				category:
					categorySelect === "Other"
						? (categoryOther ?? "").trim()
						: (categorySelect ?? ""),
				methods,
				website: website.value,
				phone: phone.value,
				hours: hours.value,
				notes: notes.value,
				source,
				sourceOther: sourceOther ? sourceOther : "",
				contact: contact.value,
			})
			.then(() => {
				submitted = true;
			})
			.catch((error) => {
				methods = [];
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
	if (browser) {
		// fetch and add captcha
		fetchCaptcha();

		// Keyboard-first on desktop only: popping the on-screen keyboard
		// on mobile would cover the confirmation the user just landed on.
		nameFocusPending = window.matchMedia("(pointer: fine)").matches;
	}
});
</script>

<svelte:head>
	<title>BTC Map - {$_('addLocation.title')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add.png" />
	<meta property="og:title" content="BTC Map - {$_('addLocation.title')}" />
	<meta name="twitter:title" content="BTC Map - {$_('addLocation.title')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/add.png" />
</svelte:head>

{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			{$_('addLocation.title')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<!-- Same pin glyph as the map's placement crosshair — the visual cue
	     that the pin the user just confirmed is the one this page holds. -->
	<div
		class="mx-auto mt-10 flex max-w-xl items-center gap-3 rounded-2xl border-2 border-bitcoin/40 bg-bitcoin/10 px-4 py-3"
	>
		<PlacementPinIcon width={24} class="shrink-0" />
		<div>
			<p class="font-semibold text-primary dark:text-white">
				{$_('addLocation.pinConfirmedTitle')}
			</p>
			<p class="text-sm text-body dark:text-offwhite">
				{$_('addLocation.pinConfirmedHint')}
			</p>
		</div>
	</div>

	<div class="mt-16 pb-20 md:pb-32 lg:flex lg:justify-between lg:gap-10">
		<section id="form" class="mx-auto w-full lg:w-1/2 lg:border-r lg:border-input lg:pr-10">
			<div class="mx-auto max-w-xl">
				<h2
					class="mb-5 text-center text-3xl font-semibold text-primary md:text-left dark:text-white"
				>
					{$_('addLocation.heading')}
				</h2>

				<div class="mb-10 w-full text-justify text-primary dark:text-white">
					<p>
						{$_('addLocation.description')}
					</p>
					<FormHelperText text={$_('addLocation.tooltip')} />
				</div>
				<form on:submit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
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
						<p id="pin-label" class="mb-2 block font-semibold">
							{$_('addLocation.pinFromMapLabel')}
						</p>
						<!-- Static preview. The adjust link is stacked on top of the map
						     rather than wrapping it, so none of MapLibre's interactive
						     attribution nests inside the anchor; its corner is raised
						     above the link so credits stay one tap away, as on the
						     merchant hero. -->
						<div
							class="relative mb-2 h-[300px] overflow-hidden rounded-2xl border-2 border-input md:h-[400px] [&_.maplibregl-ctrl-bottom-right]:z-20"
						>
							<StaticMapPreview
								lat={coords.lat}
								long={coords.long}
								zoom={CLUSTERING_DISABLED_ZOOM}
							/>
							<a
								href={adjustUrl}
								aria-labelledby="pin-label"
								class="absolute inset-0 z-10 focus:outline-link"
							></a>
							<div
								class="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-full drop-shadow-lg"
							>
								<PlacementPinIcon width={40} />
							</div>
						</div>
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
									categoryOtherElement.focus();
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
						<legend class="mb-2 block font-semibold"
							>{$_('addLocation.paymentMethodsLegend')}</legend
						>
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
									on:click={handleCheckboxClick}
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
									on:click={handleCheckboxClick}
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
									on:click={handleCheckboxClick}
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
							on:click={() => (showMoreDetails = !showMoreDetails)}
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
							<div class="mb-2">
								<label for="address" class="block font-semibold">{$_('addLocation.addressLabel')}</label>
								<FormHelperText text={$_('addLocation.addressTooltip')} />
							</div>

							<input
								disabled={!captchaSecret}
								type="text"
								name="address"
								id="address"
								placeholder={$_('addLocation.addressPlaceholder')}
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
								bind:this={address}
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
								placeholder={$_('addLocation.phonePlaceholder')}
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
								bind:this={phone}
							/>
						</div>

						<div>
							<label for="hours" class="mb-2 block font-semibold"
								>{$_('forms.openingHours')}
								<span class="font-normal">{$_('forms.optional')}</span></label
							>
							<input
								disabled={!captchaSecret}
								type="text"
								name="hours"
								placeholder={$_('addLocation.hoursPlaceholder')}
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
								bind:this={hours}
							/>
						</div>

						<div>
							<label for="notes" class="mb-2 block font-semibold"
								>{$_('forms.notes')} <span class="font-normal">{$_('forms.optional')}</span></label
							>
							<textarea
								disabled={!captchaSecret}
								name="notes"
								placeholder={$_('addLocation.notesPlaceholder')}
								rows="3"
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
								bind:this={notes}
							></textarea>
						</div>
					</div>

					<div>
						<label for="source" class="mb-2 block font-semibold"
							>{$_('addLocation.dataSourceLabel')}</label
						>
						<FormSelect
							id="source"
							disabled={!captchaSecret}
							name="source"
							required
							bind:value={source}
							on:change={async () => {
								if (source === 'Other') {
									await tick();
									sourceOtherElement.focus();
								}
							}}
						>
							<option value="">{$_('addLocation.dataSourcePlaceholder')}</option>
							<option value="Business Owner">{$_('addLocation.dataSourceOwner')}</option>
							<option value="Customer">{$_('addLocation.dataSourceCustomer')}</option>
							<option value="Other">{$_('addLocation.dataSourceOther')}</option>
						</FormSelect>
						{#if source === 'Other'}
							<p class="my-2 text-justify text-sm">
								{$_('addLocation.dataSourceOtherPrompt')}
							</p>
							<textarea
								disabled={!captchaSecret}
								required
								name="source-other"
								placeholder={$_('addLocation.dataSourceOtherPlaceholder')}
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
								bind:value={sourceOther}
								bind:this={sourceOtherElement}
							></textarea>
						{/if}
					</div>

					<div>
						<label for="contact" class="mb-2 block font-semibold">{$_('forms.contact')}</label>
						<p class="mb-2 text-justify text-sm">
							{$_('addLocation.contactDescription')}
						</p>
						<input
							disabled={!captchaSecret}
							required
							type="email"
							name="contact"
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
								<button type="button" on:click={fetchCaptcha}>
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
			</div>
		</section>

		<section
			id="supertagger"
			class="mx-auto mt-14 w-full border-t border-input pt-14 lg:mt-0 lg:w-1/2 lg:border-t-0 lg:pt-0 lg:pl-10"
		>
			<div class="lg:flex lg:justify-start">
				<div class="mx-auto max-w-xl text-primary dark:text-white">
					<h2 class="mb-5 text-center text-3xl font-semibold md:text-left">
						{$_('addLocation.supertaggerHeading')}
					</h2>
					<p class="mb-10 w-full text-justify md:text-left">
						{$_('addLocation.supertaggerDescription')}
					</p>
					<img
						src="/images/supertagger.svg"
						alt={$_('addLocation.supertaggerImageAlt')}
						class="mx-auto mb-10 h-[220px] w-[220px]"
					/>
					<PrimaryButton
						style="w-full py-3 rounded-xl"
						link="https://wiki.btcmap.org/Tagging-Merchants#shadowy-supertaggers-"
						external={true}
					>
						{$_('addLocation.supertaggerWikiButton')}
					</PrimaryButton>
				</div>
			</div>
		</section>
	</div>
{:else}
	<FormSuccess
		type={$_('addLocation.formSuccessType')}
		text={$_('addLocation.formSuccessText')}
		showIssueLink={false}
		on:click={() => goto(placementEntryUrl('another'))}
	/>
{/if}
