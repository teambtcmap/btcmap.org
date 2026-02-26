<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import { onMount } from "svelte";
import { _ } from "svelte-i18n";

import Breadcrumbs from "$components/Breadcrumbs.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import Icon from "$components/Icon.svelte";
import InfoTooltip from "$components/InfoTooltip.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { theme } from "$lib/theme";
import type { NominatimResponse } from "$lib/types";
import { errToast, successToast, warningToast } from "$lib/utils";

import { browser } from "$app/environment";

$: t = $_;
$: routes = [
	{ name: t("addCommunityForm.breadcrumbCommunities"), url: "/communities" },
	{ name: t("addCommunityForm.breadcrumbAdd"), url: "/communities/add" },
];

let captchaContent = "";
let isCaptchaLoading = true;
let captchaSecret: string;
let captchaValue: string = "";
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
			errToast(t("addCommunityForm.captchaFetchError"));
			console.error(error);
		})
		.finally(() => {
			isCaptchaLoading = false;
		});
};

let location: string | undefined;
let name: string;
let icon: string;
let lightning: string;
let socialLinks: string;
let contact: string;
let notes: string;

let selected = false;
let noLocationSelected = false;
let submitted = false;
let submitting = false;
let submissionIssueNumber: number;

let searchQuery: string;
let searchResults: NominatimResponse[] = [];
let searchLoading = false;

const searchLocation = () => {
	searchLoading = true;
	searchResults = [];
	location = undefined;
	selected = false;

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
	location = area.display_name;
	selected = true;
	successToast(t("addCommunityForm.locationSelectedToast"));
};

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (!selected) {
		noLocationSelected = true;
		errToast(t("addCommunityForm.locationError"));
	} else {
		submitting = true;

		axios
			.post("/api/gitea/issue", {
				type: "community",
				captchaSecret,
				captchaTest: captchaValue,
				honey: honeyInput,
				location,
				name,
				icon: icon ? icon : "",
				lightning: lightning ? lightning : "",
				socialLinks: socialLinks ? socialLinks : "",
				contact,
				notes: notes ? notes : "",
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
	}
};

const formReset = () => {
	// Reset state variables
	selected = false;
	noLocationSelected = false;
	submitted = false;
	submitting = false;
	searchQuery = "";
	searchResults = [];
	searchLoading = false;

	// Clear form fields
	location = undefined;
	name = "";
	icon = "";
	lightning = "";
	socialLinks = "";
	contact = "";
	notes = "";
	captchaValue = ""; // Reset the value directly

	// Refresh captcha
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

		<p class="mb-5 w-full text-center text-primary dark:text-white">
			{$_('addCommunityForm.description')} <InfoTooltip
				tooltip={$_('addCommunityForm.tooltip')}
			/>
		</p>

		<div class="mb-10 w-full text-primary dark:text-white">
			<p class="font-semibold">{$_('addCommunityForm.criteriaHeading')}</p>
			<ul class="ml-5 list-disc">
				<li>{$_('addCommunityForm.criteria1')}</li>
				<li>{$_('addCommunityForm.criteria2')}</li>
				<li>{$_('addCommunityForm.criteria3')}</li>
				<li>{$_('addCommunityForm.criteria4')}</li>
			</ul>
		</div>

		<form on:submit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
			<div class="space-y-2">
				<label for="location-picker" class="block font-semibold">{$_('addCommunityForm.locationLabel')}</label>
				<p class="text-sm">{$_('addCommunityForm.locationHint')}</p>

				{#if selected}
					<span class="font-semibold text-green-500">{$_('addCommunityForm.locationSelected')}</span>
				{:else if noLocationSelected}
					<span class="font-semibold text-error">{$_('addCommunityForm.locationError')}</span>
				{/if}

				<div class="space-y-2 md:flex md:space-y-0 md:space-x-2">
					<input
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								searchLocation();
							}
						}}
						disabled={!captchaSecret}
						type="text"
						name="location"
						placeholder={$_('addCommunityForm.locationPlaceholder')}
						required
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
						bind:value={searchQuery}
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
						class="{!location
							? 'bg-white dark:bg-dark'
							: ''} max-h-[300px] overflow-auto border-2 border-input"
					>
						{#if !location}
							{#each searchResults as area, index (area.display_name)}
								<button
									on:click={() => setLocation(area)}
									class="{index !== searchResults.length - 1
										? 'border-b'
										: ''} block p-3 whitespace-nowrap hover:bg-link/50">{area.display_name}</button
								>
							{/each}
						{:else}
							<p class="p-3 font-semibold whitespace-nowrap">{location}</p>
						{/if}
					</div>
				{/if}
			</div>

			<div>
				<label for="name" class="mb-2 block font-semibold">{$_('addCommunityForm.nameLabel')}</label>
				<input
					disabled={!captchaSecret}
					type="text"
					name="name"
					placeholder={$_('addCommunityForm.namePlaceholder')}
					required
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={name}
				/>
			</div>

			<div>
				<label for="icon" class="mb-2 block font-semibold"
					>{$_('addCommunityForm.iconLabel')} <span class="font-normal">({$_('addCommunityForm.iconOptional')})</span></label
				>
				<p class="mb-2 text-sm">
					{$_('addCommunityForm.iconHint')}
				</p>
				<input
					disabled={!captchaSecret}
					type="url"
					name="icon"
					placeholder={$_('addCommunityForm.iconPlaceholder')}
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={icon}
				/>
			</div>

			<div>
				<label for="lightning" class="mb-2 block font-semibold"
					>{$_('addCommunityForm.lightningLabel')} <span class="font-normal">({$_('addCommunityForm.iconOptional')})</span></label
				>
				<p class="mb-2 text-sm">
					{$_('addCommunityForm.lightningHint')} <a
						href="https://lightningaddress.com/"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">{$_('addCommunityForm.lightningAddress')}</a
					>
					{$_('addCommunityForm.lightningOr')}
					<a
						href="https://github.com/fiatjaf/lnurl-rfc#lnurl-documents"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">{$_('addCommunityForm.lightningLnurl')}</a
					> {$_('addCommunityForm.lightningSuffix')}
				</p>
				<input
					disabled={!captchaSecret}
					type="text"
					name="lightning"
					placeholder={$_('addCommunityForm.lightningPlaceholder')}
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={lightning}
				/>
			</div>

			<div>
				<label for="socials" class="mb-2 block font-semibold">{$_('addCommunityForm.socialsLabel')}</label>
				<p class="mb-2 text-sm">
					{$_('addCommunityForm.socialsHint')}
				</p>

				<textarea
					required
					disabled={!captchaSecret}
					name="socials"
					placeholder={$_('addCommunityForm.socialsPlaceholder')}
					rows="3"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={socialLinks}
				/>
			</div>

			<div>
				<label for="icon" class="mb-2 block font-semibold">{$_('addCommunityForm.contactLabel')}</label>
				<p class="mb-2 text-sm">
					{$_('addCommunityForm.contactHint')}
				</p>
				<input
					required
					disabled={!captchaSecret}
					type="text"
					name="contact"
					placeholder={$_('addCommunityForm.contactPlaceholder')}
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={contact}
				/>
			</div>

			<div>
				<label for="notes" class="mb-2 block font-semibold"
					>{$_('addCommunityForm.notesLabel')} <span class="font-normal">({$_('addCommunityForm.iconOptional')})</span></label
				>
				<p class="mb-2 text-sm">
					{$_('addCommunityForm.notesHint')}
				</p>

				<textarea
					disabled={!captchaSecret}
					name="notes"
					placeholder={$_('addCommunityForm.notesPlaceholder')}
					rows="2"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={notes}
				/>
			</div>

			<div>
				<div class="mb-2 flex items-center space-x-2">
					<label for="captcha" class="font-semibold"
						>{$_('addCommunityForm.captchaLabel')} <span class="font-normal">({$_('addCommunityForm.captchaCaseSensitive')})</span></label
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
							<div class="h-[100px] w-[275px] animate-pulse bg-link/50" />
						{:else}
							<!-- eslint-disable-next-line svelte/no-at-html-tags - we even sanitize the captcha content above -->
							{@html captchaContent}
						{/if}
					</div>
					<input
						disabled={!captchaSecret}
						required
						type="text"
						name="captcha"
						placeholder={$_('addCommunityForm.captchaPlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
						bind:value={captchaValue}
					/>
				</div>
			</div>

			<input
				type="text"
				name="honey"
				placeholder={$_('addCommunityForm.honeyPlaceholder')}
				class="hidden"
				bind:value={honeyInput}
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
