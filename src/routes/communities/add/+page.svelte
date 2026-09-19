<script lang="ts">
import { createForm, revalidateLogic } from "@tanstack/svelte-form";
import axios from "axios";
import { onMount } from "svelte";
import { _ } from "svelte-i18n";

import Breadcrumbs from "$components/Breadcrumbs.svelte";
import FormHelperText from "$components/FormHelperText.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import CaptchaField from "$components/form/CaptchaField.svelte";
import FieldError from "$components/form/FieldError.svelte";
import TextArea from "$components/form/TextArea.svelte";
import TextField from "$components/form/TextField.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
import type { CommunityField } from "$lib/addCommunityValidation";
import {
	firstInvalidCommunityField,
	validateCommunity,
} from "$lib/addCommunityValidation";
import { fieldBorderClasses } from "$lib/fieldStyles";
import { focusInvalid } from "$lib/formValidation";
import { theme } from "$lib/theme";
import type { NominatimResponse } from "$lib/types";
import { errToast, successToast, warningToast } from "$lib/utils";

import { browser } from "$app/environment";

const t = $derived($_);
const routes = $derived([
	{ name: t("addCommunityForm.breadcrumbCommunities"), url: "/communities" },
	{ name: t("addCommunityForm.breadcrumbAdd"), url: "/communities/add" },
]);

let captchaContent = $state("");
let isCaptchaLoading = $state(true);
let captchaSecret = $state<string>();
let honeyInput = $state<HTMLInputElement>();

const fetchCaptcha = () => {
	isCaptchaLoading = true;
	axios
		.get("/captcha")
		.then((response) => {
			captchaSecret = response.data.captchaSecret;
			captchaContent = response.data.captcha;
		})
		.catch((error) => {
			errToast(t("addCommunityForm.captchaFetchError"));
			console.error(error);
		})
		.finally(() => {
			isCaptchaLoading = false;
		});
};

let submitted = $state(false);
let submitting = $state(false);
let submissionIssueNumber = $state<number>();

let searchQuery = $state("");
let searchResults = $state<NominatimResponse[]>([]);
let searchLoading = $state(false);

let searchInput = $state<HTMLInputElement>();
let nameInput = $state<HTMLInputElement>();
let iconInput = $state<HTMLInputElement>();
let socialsInput = $state<HTMLTextAreaElement>();
let contactInput = $state<HTMLInputElement>();
let captchaInput = $state<HTMLInputElement>();

// SPIKE (TanStack Form): the same rules as #1409, wired through the library.
type CommunityValues = {
	location: string;
	name: string;
	icon: string;
	lightning: string;
	socials: string;
	contact: string;
	notes: string;
	captcha: string;
};

const MESSAGE_KEY: Record<CommunityField, string> = {
	location: "addCommunityForm.locationError",
	name: "addCommunityForm.nameRequired",
	icon: "addCommunityForm.iconInvalid",
	socials: "addCommunityForm.socialsRequired",
	contact: "addCommunityForm.contactRequired",
	captcha: "forms.captchaRequired",
};

const invalidControl: Record<CommunityField, () => HTMLElement | undefined> = {
	location: () => searchInput,
	name: () => nameInput,
	icon: () => iconInput,
	socials: () => socialsInput,
	contact: () => contactInput,
	captcha: () => captchaInput,
};

const defaultValues: CommunityValues = {
	location: "",
	name: "",
	icon: "",
	lightning: "",
	socials: "",
	contact: "",
	notes: "",
	captcha: "",
};

const form = createForm(() => ({
	defaultValues,
	// react-hook-form's default: validate on submit, then on every change.
	validationLogic: revalidateLogic({
		mode: "submit",
		modeAfterSubmission: "change",
	}),
	validators: {
		onDynamic: ({ value }: { value: CommunityValues }) => {
			const errors = validateCommunity({
				locationSelected: !!value.location,
				name: value.name,
				icon: value.icon,
				socials: value.socials,
				contact: value.contact,
				captcha: value.captcha,
			});
			if (!firstInvalidCommunityField(errors)) return undefined;
			return {
				fields: Object.fromEntries(
					Object.keys(errors).map((field) => [
						field,
						t(MESSAGE_KEY[field as CommunityField]),
					]),
				),
			};
		},
	},
	onSubmitInvalid: ({ formApi }) => {
		const flagged = Object.fromEntries(
			Object.keys(MESSAGE_KEY)
				.filter(
					(field) =>
						formApi.getFieldMeta(field as CommunityField)?.errors.length,
				)
				.map((field) => [field, "invalid"]),
		);
		const first = firstInvalidCommunityField(flagged);
		if (first) focusInvalid(invalidControl[first]());
	},
	onSubmit: ({ value }) => {
		submitting = true;
		axios
			.post("/api/gitea/issue", {
				type: "community",
				captchaSecret,
				captchaTest: value.captcha,
				honey: honeyInput?.value,
				location: value.location,
				name: value.name,
				icon: value.icon.trim(),
				lightning: value.lightning,
				socialLinks: value.socials,
				contact: value.contact,
				notes: value.notes,
			})
			.then((response) => {
				submissionIssueNumber = response.data.number;
				submitted = true;
			})
			.catch((error) => {
				if (error.response.data.message.includes("Captcha")) {
					errToast(error.response.data.message);
				} else {
					errToast(t("addCommunityForm.formSubmitError"));
				}

				console.error(error);
				submitting = false;
			});
	},
}));

// The field's first error, as the components take it.
const errorOf = (errors: unknown[]): string | undefined =>
	errors.length ? String(errors[0]) : undefined;

const searchLocation = () => {
	searchLoading = true;
	searchResults = [];
	form.setFieldValue("location", "");

	axios
		.get<NominatimResponse[]>(
			`https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&polygon_geojson=1&email=hello@btcmap.org`,
		)
		.then((response) => {
			searchResults = response.data.filter(
				(area) =>
					area.geojson?.type === "Polygon" ||
					area.geojson?.type === "MultiPolygon",
			);
			if (!searchResults.length) {
				warningToast(t("addCommunityForm.noLocationsWarning"));
			}
			searchLoading = false;
		})
		.catch((error) => {
			errToast(t("addCommunityForm.searchError"));
			searchLoading = false;
			console.error(error);
		});
};

const setLocation = (area: { display_name: string }) => {
	form.setFieldValue("location", area.display_name);
	successToast(t("addCommunityForm.locationSelectedToast"));
};

const formReset = () => {
	form.reset();
	submitted = false;
	submitting = false;
	searchQuery = "";
	searchResults = [];
	searchLoading = false;
	fetchCaptcha();
};

onMount(async () => {
	if (browser) {
		// fetch and add captcha
		fetchCaptcha();
	}
});
</script>

<svelte:head>
	<title>BTC Map - {$_('meta.addCommunity')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add-community.png" />
	<meta property="og:title" content="BTC Map - {$_('meta.addCommunity')}" />
	<meta name="twitter:title" content="BTC Map - {$_('meta.addCommunity')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/add-community.png" />
</svelte:head>

<Breadcrumbs {routes} />
{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			{$_('addCommunityForm.hero')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<section id="add-community" class="mx-auto mt-16 w-full pb-20 md:w-[600px] md:pb-32">
		<h2 class="mb-5 text-center text-3xl font-semibold text-primary dark:text-white">
			{$_('addCommunityForm.heading')}
		</h2>

		<div class="mb-2 w-full text-center text-primary md:text-left dark:text-white">
			<p class="m-0">{$_('addCommunityForm.description')}</p>
			<FormHelperText text={$_('addCommunityForm.tooltip')} />
		</div>

		<div class="mb-10 w-full text-primary dark:text-white">
			<p class="font-semibold">{$_('addCommunityForm.criteriaHeading')}</p>
			<ul class="ml-5 list-disc">
				<li>{$_('addCommunityForm.criteria1')}</li>
				<li>{$_('addCommunityForm.criteria2')}</li>
				<li>{$_('addCommunityForm.criteria3')}</li>
				<li>{$_('addCommunityForm.criteria4')}</li>
			</ul>
		</div>

		<!-- `novalidate`: the form reports its own errors inline (#1409)
		     instead of the browser's bubbles. -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			novalidate
			class="w-full space-y-5 text-primary dark:text-white"
		>
			<form.Field name="location">
				{#snippet children(field)}
					{@const error = errorOf(field.state.meta.errors)}
					<div class="space-y-2">
						<label for="location-picker" class="block font-semibold">{$_('addCommunityForm.locationLabel')}</label>
						{#if error}
							<FieldError id="location-error" message={error} class="" />
						{/if}
						<p class="text-sm">{$_('addCommunityForm.locationHint')}</p>

						{#if field.state.value}
							<span class="font-semibold text-green-500">{$_('addCommunityForm.locationSelected')}</span>
						{/if}

						<div class="space-y-2 md:flex md:space-y-0 md:space-x-2">
							<!-- Enter runs the search, not the form: the form would
							     otherwise submit and flag every other field. -->
							<input
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										searchLocation();
									}
								}}
								disabled={!captchaSecret}
								type="text"
								id="location-picker"
								name="location"
								placeholder={$_('addCommunityForm.locationPlaceholder')}
								required
								aria-invalid={error ? 'true' : undefined}
								aria-describedby={error ? 'location-error' : undefined}
								class="w-full rounded-2xl border-2 {fieldBorderClasses(
									!!error
								)} p-3 transition-all disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
								bind:value={searchQuery}
								bind:this={searchInput}
							/>
							<PrimaryButton
								type="button"
								on:click={searchLocation}
								loading={searchLoading}
								disabled={!captchaSecret || searchLoading || !searchQuery}
								style="{!searchQuery
									? 'opacity-50 hover:bg-link'
									: ''} w-full md:w-[210px] py-3 rounded-xl"
							>
								{$_('forms.searchButton')}
							</PrimaryButton>
						</div>

						{#if searchResults && searchResults.length}
							<div
								class="{!field.state.value
									? 'bg-white dark:bg-dark'
									: ''} max-h-[300px] overflow-auto border-2 border-input"
							>
								{#if !field.state.value}
									{#each searchResults as area, index (area.display_name)}
										<!-- type="button": picking a result mustn't submit. -->
										<button
											type="button"
											onclick={() => setLocation(area)}
											class="{index !== searchResults.length - 1
												? 'border-b'
												: ''} block p-3 whitespace-nowrap hover:bg-link/50">{area.display_name}</button
										>
									{/each}
								{:else}
									<p class="p-3 font-semibold whitespace-nowrap">{field.state.value}</p>
								{/if}
							</div>
						{/if}
					</div>
				{/snippet}
			</form.Field>

			<form.Field name="name">
				{#snippet children(field)}
					<TextField
						id="name"
						name="name"
						label={$_('addCommunityForm.nameLabel')}
						disabled={!captchaSecret}
						required
						placeholder={$_('addCommunityForm.namePlaceholder')}
						error={errorOf(field.state.meta.errors)}
						value={field.state.value}
						oninput={(e: Event) => field.handleChange((e.currentTarget as HTMLInputElement).value)}
						bind:element={nameInput}
					/>
				{/snippet}
			</form.Field>

			<form.Field name="icon">
				{#snippet children(field)}
					<TextField
						id="icon"
						name="icon"
						label={$_('addCommunityForm.iconLabel')}
						optional
						inputmode="url"
						disabled={!captchaSecret}
						placeholder={$_('addCommunityForm.iconPlaceholder')}
						error={errorOf(field.state.meta.errors)}
						value={field.state.value}
						oninput={(e: Event) => field.handleChange((e.currentTarget as HTMLInputElement).value)}
						bind:element={iconInput}
					>
						{#snippet hint()}
							<p class="mb-2 text-sm">{$_('addCommunityForm.iconHint')}</p>
						{/snippet}
					</TextField>
				{/snippet}
			</form.Field>

			<form.Field name="lightning">
				{#snippet children(field)}
					<TextField
						id="lightning"
						name="lightning"
						label={$_('addCommunityForm.lightningLabel')}
						optional
						disabled={!captchaSecret}
						placeholder={$_('addCommunityForm.lightningPlaceholder')}
						value={field.state.value}
						oninput={(e: Event) => field.handleChange((e.currentTarget as HTMLInputElement).value)}
					>
						{#snippet hint()}
							<p class="mb-2 text-sm">
								{$_('addCommunityForm.lightningHint')} <TextLink
									link="https://lightningaddress.com/"
									external>{$_('addCommunityForm.lightningAddress')}</TextLink
								>
								{$_('addCommunityForm.lightningOr')}
								<TextLink
									link="https://github.com/fiatjaf/lnurl-rfc#lnurl-documents"
									external>{$_('addCommunityForm.lightningLnurl')}</TextLink
								> {$_('addCommunityForm.lightningSuffix')}
							</p>
						{/snippet}
					</TextField>
				{/snippet}
			</form.Field>

			<form.Field name="socials">
				{#snippet children(field)}
					<TextArea
						id="socials"
						name="socials"
						label={$_('addCommunityForm.socialsLabel')}
						disabled={!captchaSecret}
						required
						placeholder={$_('addCommunityForm.socialsPlaceholder')}
						error={errorOf(field.state.meta.errors)}
						value={field.state.value}
						oninput={(e: Event) => field.handleChange((e.currentTarget as HTMLTextAreaElement).value)}
						bind:element={socialsInput}
					>
						{#snippet hint()}
							<p class="mb-2 text-sm">{$_('addCommunityForm.socialsHint')}</p>
						{/snippet}
					</TextArea>
				{/snippet}
			</form.Field>

			<form.Field name="contact">
				{#snippet children(field)}
					<TextField
						id="contact"
						name="contact"
						label={$_('addCommunityForm.contactLabel')}
						disabled={!captchaSecret}
						required
						placeholder={$_('addCommunityForm.contactPlaceholder')}
						error={errorOf(field.state.meta.errors)}
						value={field.state.value}
						oninput={(e: Event) => field.handleChange((e.currentTarget as HTMLInputElement).value)}
						bind:element={contactInput}
					>
						{#snippet hint()}
							<p class="mb-2 text-sm">{$_('addCommunityForm.contactHint')}</p>
						{/snippet}
					</TextField>
				{/snippet}
			</form.Field>

			<form.Field name="notes">
				{#snippet children(field)}
					<TextArea
						id="notes"
						name="notes"
						label={$_('addCommunityForm.notesLabel')}
						optional
						rows={2}
						disabled={!captchaSecret}
						placeholder={$_('addCommunityForm.notesPlaceholder')}
						value={field.state.value}
						oninput={(e: Event) => field.handleChange((e.currentTarget as HTMLTextAreaElement).value)}
					>
						{#snippet hint()}
							<p class="mb-2 text-sm">{$_('addCommunityForm.notesHint')}</p>
						{/snippet}
					</TextArea>
				{/snippet}
			</form.Field>

			<form.Field name="captcha">
				{#snippet children(field)}
					<CaptchaField
						content={captchaContent}
						loading={isCaptchaLoading}
						onrefresh={fetchCaptcha}
						disabled={!captchaSecret}
						invalid={field.state.meta.errors.length > 0}
						value={field.state.value}
						oninput={(e) => field.handleChange(e.currentTarget.value)}
						bind:element={captchaInput}
					/>
				{/snippet}
			</form.Field>

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
				{$_('addCommunityForm.submitButton')}
			</PrimaryButton>
		</form>
	</section>
{:else}
	<FormSuccess
		type={$_('addCommunityForm.successType')}
		text={$_('addCommunityForm.successMessage')}
		issue={submissionIssueNumber}
		buttonWidth="w-60"
		on:click={formReset}
	/>
{/if}
