<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { merchantList } from '$lib/merchantListStore';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import MerchantListItem from './MerchantListItem.svelte';
	import CloseButton from '$components/CloseButton.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import Icon from '$components/Icon.svelte';
	import type { Place } from '$lib/types';
	import { MERCHANT_LIST_MIN_ZOOM, MERCHANT_LIST_LOW_ZOOM } from '$lib/constants';
	import { calcVerifiedDate } from '$lib/merchantDrawerLogic';

	const verifiedDate = calcVerifiedDate();

	export let currentZoom: number = 0;
	export let onSelectMerchant: ((place: Place) => void) | undefined = undefined;

	$: isOpen = $merchantList.isOpen;
	$: merchants = $merchantList.merchants;
	$: totalCount = $merchantList.totalCount;
	$: placeDetailsCache = $merchantList.placeDetailsCache;
	$: isLoadingList = $merchantList.isLoadingList;
	$: showZoomInMessage =
		currentZoom < MERCHANT_LIST_LOW_ZOOM ||
		(currentZoom < MERCHANT_LIST_MIN_ZOOM && merchants.length === 0 && !isLoadingList);

	// Reduced motion support
	let prefersReducedMotion = false;
	if (browser) {
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	// Focus management
	let dialogElement: HTMLDivElement | null = null;
	let closeButtonElement: HTMLDivElement | null = null;
	let previouslyFocusedElement: HTMLElement | null = null;

	function handleItemClick(event: CustomEvent<Place>) {
		const place = event.detail;
		merchantList.close();
		onSelectMerchant?.(place);
		merchantDrawer.open(place.id, 'details');
	}

	function handleClose() {
		merchantList.close();
	}

	// Focus trap - keep focus within dialog
	function getFocusableElements(): HTMLElement[] {
		if (!dialogElement) return [];
		return Array.from(
			dialogElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
			return;
		}

		// Focus trap on Tab
		if (event.key === 'Tab') {
			const focusable = getFocusableElements();
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	let listenerAttached = false;

	$: if (browser) {
		if (isOpen && !listenerAttached) {
			window.addEventListener('keydown', handleKeydown);
			listenerAttached = true;
		} else if (!isOpen && listenerAttached) {
			window.removeEventListener('keydown', handleKeydown);
			listenerAttached = false;
		}
	}

	// Focus management - move focus to close button on open, restore on close
	let focusManaged = false;

	$: if (browser) {
		if (isOpen && !focusManaged) {
			previouslyFocusedElement = document.activeElement as HTMLElement;
			focusManaged = true;
			tick().then(() => {
				const closeBtn = closeButtonElement?.querySelector('button');
				if (closeBtn) {
					closeBtn.focus();
				}
			});
		} else if (!isOpen && focusManaged) {
			focusManaged = false;
			if (previouslyFocusedElement) {
				previouslyFocusedElement.focus();
				previouslyFocusedElement = null;
			}
		}
	}

	// Body scroll lock - prevent background scroll when list is open
	let bodyOverflowBackup = '';
	let bodyScrollLocked = false;

	$: if (browser) {
		if (isOpen && !bodyScrollLocked) {
			bodyOverflowBackup = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			bodyScrollLocked = true;
		} else if (!isOpen && bodyScrollLocked) {
			document.body.style.overflow = bodyOverflowBackup;
			bodyScrollLocked = false;
		}
	}

	onDestroy(() => {
		if (browser && listenerAttached) {
			window.removeEventListener('keydown', handleKeydown);
			listenerAttached = false;
		}
		if (browser && bodyScrollLocked) {
			document.body.style.overflow = bodyOverflowBackup;
			bodyScrollLocked = false;
		}
	});
</script>

{#if isOpen}
	<div
		bind:this={dialogElement}
		class="pt-safe pb-safe fixed inset-0 z-[1001] flex flex-col bg-white md:hidden dark:bg-dark"
		transition:fly={{ y: prefersReducedMotion ? 0 : 800, duration: prefersReducedMotion ? 0 : 300 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="merchant-list-title"
	>
		<!-- Header -->
		<div
			class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/10"
		>
			<div>
				<h2 id="merchant-list-title" class="text-lg font-semibold text-primary dark:text-white">
					Nearby Merchants
				</h2>
				{#if showZoomInMessage}
					<p class="text-xs text-body dark:text-white/70">Zoom in to see list</p>
				{:else if totalCount > merchants.length}
					<p class="text-xs text-body dark:text-white/70">
						Showing {merchants.length} nearest of {totalCount}
					</p>
				{:else if totalCount > 0}
					<p class="text-xs text-body dark:text-white/70">
						{totalCount} location{totalCount !== 1 ? 's' : ''} found
					</p>
				{/if}
			</div>
			<div bind:this={closeButtonElement}>
				<CloseButton on:click={handleClose} />
			</div>
		</div>

		<!-- List content -->
		<div class="flex-1 overflow-y-auto">
			{#if showZoomInMessage}
				<div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
					<Icon
						w="48"
						h="48"
						icon="zoom_in"
						type="material"
						style="text-gray-300 dark:text-white/30"
					/>
					<div>
						<p class="text-sm font-medium text-primary dark:text-white">
							Zoom in to see nearby merchants
						</p>
						<p class="mt-1 text-xs text-body dark:text-white/70">
							The merchant list shows locations when zoomed in closer
						</p>
					</div>
				</div>
			{:else if isLoadingList}
				<div class="flex items-center justify-center py-8">
					<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
				</div>
			{:else if merchants.length === 0}
				<div class="px-4 py-8 text-center text-sm text-body dark:text-white/70">
					No merchants visible in current view
				</div>
			{:else}
				<ul class="divide-y divide-gray-100 dark:divide-white/5">
					{#each merchants as merchant (merchant.id)}
						<MerchantListItem
							{merchant}
							enrichedData={placeDetailsCache.get(merchant.id) || null}
							isSelected={false}
							{verifiedDate}
							on:click={handleItemClick}
						/>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}
