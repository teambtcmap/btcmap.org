import { get } from 'svelte/store';
import axios from 'axios';
import { boost, exchangeRate } from '$lib/store';
import { fetchExchangeRate, errToast } from '$lib/utils';
import { updateMerchantHash } from '$lib/merchantDrawerHash';
import type { Place, Boost } from '$lib/types';
import type { Writable } from 'svelte/store';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';

export function calcVerifiedDate(): number {
	const verifiedDate = new Date();
	const previousYear = verifiedDate.getFullYear() - 1;
	return verifiedDate.setFullYear(previousYear);
}

export function isUpToDate(merchant: Place | null, verifiedDate: number): boolean {
	return !!(merchant?.verified_at && Date.parse(merchant.verified_at) > verifiedDate);
}

export function isBoosted(merchant: Place | null): boolean {
	return !!(merchant?.boosted_until && Date.parse(merchant.boosted_until) > Date.now());
}

export function clearBoostState(): void {
	boost.set(undefined);
	exchangeRate.set(undefined);
}

function createBoostObject(merchant: Place) {
	const boostedUntil = isBoosted(merchant) ? merchant.boosted_until || '' : '';
	return {
		id: merchant.id,
		name: merchant.name || '',
		boost: boostedUntil
	};
}

export async function fetchMerchantDetails(
	id: number,
	currentMerchantId: number | null,
	setMerchant: (merchant: Place | null) => void,
	setFetching: (fetching: boolean) => void,
	setLastFetched: (id: number) => void,
	abortSignal?: AbortSignal
): Promise<void> {
	setLastFetched(id);
	setFetching(true);
	setMerchant(null);

	try {
		const response = await axios.get(
			`https://api.btcmap.org/v4/places/${id}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`,
			{
				timeout: 10000, // 10 second timeout
				signal: abortSignal // Support request cancellation
			}
		);
		if (currentMerchantId === id) {
			setMerchant(response.data);
		}
	} catch (error) {
		// Don't show error if request was cancelled (expected behavior)
		if (axios.isCancel(error)) {
			return;
		}
		console.error('Error fetching merchant details:', error);
		errToast('Error loading merchant details. Please try again.');
	} finally {
		setFetching(false);
	}
}

export function hasCompleteData(place: Place | undefined): place is Place {
	if (!place) return false;
	return place.name !== undefined && place.address !== undefined && place.verified_at !== undefined;
}

export async function handleBoost(
	merchant: Place | null,
	merchantId: number | null,
	setBoostLoading: (loading: boolean) => void
): Promise<void> {
	if (!merchant) return;

	setBoostLoading(true);
	boost.set(createBoostObject(merchant));

	try {
		const rate = await fetchExchangeRate();
		exchangeRate.set(rate);
		updateMerchantHash(merchantId, 'boost');
		setBoostLoading(false);
	} catch (error) {
		console.error('Error fetching exchange rate for boost:', error);
		errToast('Failed to load boost information. Please try again.');
		boost.set(undefined);
		setBoostLoading(false);
	}
}

export async function handleBoostComplete(
	merchantId: number | null,
	invalidateAll: () => Promise<void>,
	resetBoostStore?: Writable<number>
): Promise<void> {
	try {
		await invalidateAll();
	} catch (error) {
		console.error('Error invalidating data after boost:', error);
		// Continue with cleanup even if invalidation fails
	}

	clearBoostState();

	if (resetBoostStore) {
		const currentValue = get(resetBoostStore) as number;
		resetBoostStore.set(currentValue + 1);
	}

	if (merchantId) {
		updateMerchantHash(merchantId, 'details');
	}
}

export function handleCloseDrawer(
	setBoostLoading: (loading: boolean) => void,
	additionalCleanup?: () => void
): void {
	clearBoostState();
	setBoostLoading(false);

	if (additionalCleanup) {
		additionalCleanup();
	}

	updateMerchantHash(null);
}

export function handleGoBack(
	merchantId: number | null,
	setBoostLoading: (loading: boolean) => void
): void {
	clearBoostState();
	setBoostLoading(false);

	if (merchantId) {
		updateMerchantHash(merchantId, 'details');
	}
}

export async function ensureBoostData(
	merchant: Place | null,
	currentExchangeRate: number | undefined,
	currentBoost: Boost
): Promise<void> {
	if (!merchant || currentExchangeRate !== undefined) return;

	if (currentBoost === undefined) {
		boost.set(createBoostObject(merchant));
	}

	try {
		const rate = await fetchExchangeRate();
		exchangeRate.set(rate);
	} catch (error) {
		console.error('Error ensuring boost data:', error);
		// Don't show toast here as this is a background operation
	}
}
