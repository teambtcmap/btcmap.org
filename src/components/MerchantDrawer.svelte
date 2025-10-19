<script lang="ts">
	import { selectedMerchant, boost, exchangeRate, resetBoost } from '$lib/store';
	import { CloseButton, Icon } from '$lib/comp';
	import { formatVerifiedHuman } from '$lib/utils';
	import OutClick from 'svelte-outclick';
	import { fly } from 'svelte/transition';
	import Time from 'svelte-time';
	import { get } from 'svelte/store';
	import axios from 'axios';
	import { errToast } from '$lib/utils';

	$: merchant = $selectedMerchant;

	const closeDrawer = () => {
		selectedMerchant.set(null);
	};

	const handleOutClick = () => {
		closeDrawer();
	};

	// Calculate verification status
	const calcVerifiedDate = () => {
		const verifiedDate = new Date();
		const previousYear = verifiedDate.getFullYear() - 1;
		return verifiedDate.setFullYear(previousYear);
	};

	const verifiedDate = calcVerifiedDate();
	$: isUpToDate = merchant?.verified_at && Date.parse(merchant.verified_at) > verifiedDate;
	$: isBoosted = merchant?.boosted_until && Date.parse(merchant.boosted_until) > Date.now();

	let boostLoading = false;

	const handleBoost = async () => {
		if (!merchant) return;

		const boostStore = get(boost);
		if (boostStore) return; // Prevent multiple boost flows

		boostLoading = true;

		// Set the boost data in the global store
		boost.set({
			id: merchant.id,
			name: merchant.name || '',
			boost: isBoosted ? merchant.boosted_until || '' : ''
		});

		// Fetch exchange rate
		try {
			const response = await axios.get('https://blockchain.info/ticker');
			exchangeRate.set(response.data['USD']['15m']);
		} catch (error) {
			console.error('Error fetching exchange rate:', error);
			boost.set(undefined);
			boostLoading = false;
			errToast('Could not fetch bitcoin exchange rate, please try again or contact BTC Map.');
		}
	};

	// Subscribe to resetBoost store for external resets
	resetBoost.subscribe(() => {
		boostLoading = false;
	});
</script>

{#if merchant}
	<!-- Backdrop overlay -->
	<div
		class="fixed inset-0 z-[1001] bg-black/30"
		transition:fly={{ x: 0, duration: 0 }}
		on:click={handleOutClick}
		on:keydown={(e) => e.key === 'Escape' && closeDrawer()}
		role="button"
		tabindex="-1"
	/>

	<!-- Drawer -->
	<OutClick on:outclick={handleOutClick}>
		<div
			transition:fly={{ x: 400, duration: 300 }}
			class="fixed right-0 top-0 z-[1002] h-full w-full overflow-y-auto bg-white p-6 shadow-2xl dark:bg-dark md:w-[400px]"
		>
			<CloseButton on:click={closeDrawer} />

			<div class="mt-8 space-y-4">
				<!-- Merchant name -->
				{#if merchant.name}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a
						href="/merchant/{merchant.id}"
						class="inline-block text-xl font-bold leading-snug text-link transition-colors hover:text-hover"
						title="Merchant name"
					>
						{merchant.name}
					</a>
				{/if}

				<!-- Address -->
				{#if merchant.address}
					<p class="text-body dark:text-white" title="Address">
						{merchant.address}
					</p>
				{/if}

				<!-- Opening hours -->
				{#if merchant.opening_hours}
					<div class="flex items-start space-x-2" title="Opening hours">
						<Icon
							w="16"
							h="16"
							style="mt-1 text-primary dark:text-white"
							icon="clock"
							type="popup"
						/>
						<span class="text-body dark:text-white">{merchant.opening_hours}</span>
					</div>
				{/if}

				<!-- Action buttons -->
				<div class="grid grid-cols-2 gap-2">
					<a
						href="geo:{merchant.lat},{merchant.lon}"
						class="flex flex-col items-center rounded-lg border border-mapBorder py-3 text-primary transition-colors hover:border-link hover:text-link dark:text-white dark:hover:text-link"
					>
						<Icon w="24" h="24" icon="compass" type="popup" />
						<span class="mt-1 text-xs">Navigate</span>
					</a>

					<a
						href={merchant.osm_url || `https://www.openstreetmap.org/node/${merchant.id}`}
						target="_blank"
						rel="noreferrer"
						class="flex flex-col items-center rounded-lg border border-mapBorder py-3 text-primary transition-colors hover:border-link hover:text-link dark:text-white dark:hover:text-link"
					>
						<Icon w="24" h="24" icon="pencil" type="popup" />
						<span class="mt-1 text-xs">Edit</span>
					</a>

					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a
						href="/merchant/{merchant.id}"
						class="flex flex-col items-center rounded-lg border border-mapBorder py-3 text-primary transition-colors hover:border-link hover:text-link dark:text-white dark:hover:text-link"
					>
						<Icon w="24" h="24" icon="share" type="popup" />
						<span class="mt-1 text-xs">Share</span>
					</a>

					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a
						href="/merchant/{merchant.id}#comments"
						class="flex flex-col items-center rounded-lg border border-mapBorder py-3 text-primary transition-colors hover:border-link hover:text-link dark:text-white dark:hover:text-link"
					>
						<div class="text-lg font-bold">
							{merchant.comments || 0}
						</div>
						<span class="mt-1 text-xs">Comments</span>
					</a>
				</div>

				<div class="border-t border-mapBorder pt-4">
					<!-- Payment Methods -->
					{#if merchant['osm:payment:onchain'] || merchant['osm:payment:lightning'] || merchant['osm:payment:lightning_contactless'] || merchant['osm:payment:bitcoin']}
						<div class="mb-4">
							<span class="block text-xs text-mapLabel">Payment Methods</span>
							<div class="mt-1 flex space-x-2">
								<img
									src={merchant['osm:payment:onchain'] === 'yes'
										? '/icons/btc-highlight.svg'
										: merchant['osm:payment:onchain'] === 'no'
											? '/icons/btc-no.svg'
											: '/icons/btc.svg'}
									alt="bitcoin"
									class="h-6 w-6 dark:rounded-full {merchant['osm:payment:onchain'] !== 'yes'
										? 'dark:bg-white dark:p-0.5'
										: ''}"
									title={merchant['osm:payment:onchain'] === 'yes'
										? 'On-chain accepted'
										: merchant['osm:payment:onchain'] === 'no'
											? 'On-chain not accepted'
											: 'On-chain unknown'}
								/>
								<img
									src={merchant['osm:payment:lightning'] === 'yes'
										? '/icons/ln-highlight.svg'
										: merchant['osm:payment:lightning'] === 'no'
											? '/icons/ln-no.svg'
											: '/icons/ln.svg'}
									alt="lightning"
									class="h-6 w-6 dark:rounded-full {merchant['osm:payment:lightning'] !== 'yes'
										? 'dark:bg-white dark:p-0.5'
										: ''}"
									title={merchant['osm:payment:lightning'] === 'yes'
										? 'Lightning accepted'
										: merchant['osm:payment:lightning'] === 'no'
											? 'Lightning not accepted'
											: 'Lightning unknown'}
								/>
								<img
									src={merchant['osm:payment:lightning_contactless'] === 'yes'
										? '/icons/nfc-highlight.svg'
										: merchant['osm:payment:lightning_contactless'] === 'no'
											? '/icons/nfc-no.svg'
											: '/icons/nfc.svg'}
									alt="nfc"
									class="h-6 w-6 dark:rounded-full {merchant[
										'osm:payment:lightning_contactless'
									] !== 'yes'
										? 'dark:bg-white dark:p-0.5'
										: ''}"
									title={merchant['osm:payment:lightning_contactless'] === 'yes'
										? 'Lightning Contactless accepted'
										: merchant['osm:payment:lightning_contactless'] === 'no'
											? 'Lightning contactless not accepted'
											: 'Lightning contactless unknown'}
								/>
							</div>
						</div>
					{/if}

					<!-- Last Surveyed -->
					<div class="mb-4">
						<span class="block text-xs text-mapLabel" title="Completed by BTC Map community members"
							>Last Surveyed</span
						>
						<span class="block text-body dark:text-white">
							{#if merchant.verified_at}
								{formatVerifiedHuman(merchant.verified_at)}
								{#if isUpToDate}
									<Icon
										w="16"
										h="16"
										style="inline text-primary dark:text-white"
										icon="verified"
										type="popup"
									/>
								{:else}
									<Icon
										w="16"
										h="16"
										style="inline text-primary dark:text-white"
										icon="outdated"
										type="popup"
									/>
								{/if}
							{:else}
								<span title="Not verified">---</span>
							{/if}
						</span>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a
							href="/verify-location?id={merchant.id}"
							class="text-xs text-link transition-colors hover:text-hover"
							title="Help improve the data for everyone"
						>
							Verify Location
						</a>
					</div>

					<!-- Boost Section -->
					<div>
						{#if isBoosted && merchant.boosted_until}
							<span class="block text-xs text-mapLabel" title="This location is boosted!"
								>Boost Expires</span
							>
							<span class="block text-body dark:text-white">
								<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
							</span>
						{/if}

						<button
							title={isBoosted ? 'Extend Boost' : 'Boost'}
							on:click={handleBoost}
							disabled={boostLoading}
							class="mt-2 flex h-[32px] items-center justify-center space-x-2 rounded-lg border border-mapBorder px-3 text-primary transition-colors hover:border-link hover:text-link dark:text-white dark:hover:text-link"
						>
							{#if !boostLoading}
								<Icon w="16" h="16" icon={isBoosted ? 'boost-solid' : 'boost'} type="popup" />
							{/if}
							<span class="text-xs"
								>{boostLoading ? 'Boosting...' : isBoosted ? 'Extend' : 'Boost'}</span
							>
						</button>
					</div>
				</div>

				<!-- View Full Details -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a
					href="/merchant/{merchant.id}"
					class="mt-4 block rounded-lg bg-link py-3 text-center text-white transition-colors hover:bg-hover"
				>
					View Full Details
				</a>
			</div>
		</div>
	</OutClick>
{/if}
