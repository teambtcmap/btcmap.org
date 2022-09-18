<script>
	import axios from 'axios';
	import { LottiePlayer } from '@lottiefiles/svelte-lottie-player';
	import { Header, Footer, PrimaryButton } from '$comp';
	import { socials } from '$lib/store';

	let name;
	let address;
	let url;
	let methods = [];
	let onchain;
	let lightning;
	let nfc;
	let twitter;
	let notes;
	let noMethodSelected = false;
	let submitted = false;
	let submitting = false;

	const handleCheckboxClick = () => {
		noMethodSelected = false;
	};

	const submitForm = (e) => {
		e.preventDefault();

		if (!onchain.checked && !lightning.checked && !nfc.checked) {
			noMethodSelected = true;
		} else {
			submitting = true;
			if (onchain.checked) {
				methods.push('onchain');
			}
			if (lightning.checked) {
				methods.push('lightning');
			}
			if (nfc.checked) {
				methods.push('nfc');
			}

			axios
				.post('/add-location/endpoint', {
					name: name.value,
					address: address.value,
					url: url.value,
					methods: methods,
					twitter: twitter.value
						? twitter.value.startsWith('@')
							? twitter.value
							: '@' + twitter.value
						: '',
					notes: notes.value
				})
				.then(function (response) {
					console.log(response);
					submitted = true;
				})
				.catch(function (error) {
					methods = [];
					alert('Form submission failed, please try again or contact the BTC Map team.');
					console.log(error);
					submitting = false;
				});
		}
	};
</script>

<div class="bg-teal">
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<Header />
		{#if !submitted}
			<div class="space-x-4 mt-10">
				<a href="/" class="text-link hover:text-hover font-semibold"
					><i class="fa-solid fa-house mr-2" /> Home</a
				> <i class="fa-solid fa-chevron-right text-grey" />
				<span class="font-semibold">Add location</span>
			</div>

			<h1 class="text-4xl md:text-5xl font-semibold mt-8 text-center lg:text-left">
				Add a location
			</h1>

			<div class="mt-16 pb-20 md:pb-32 lg:flex justify-between">
				<section
					id="noob"
					class="mx-auto w-full md:w-2/3 lg:w-1/2 border-b lg:border-b-0 pb-14 lg:pb-0 lg:border-r border-input"
				>
					<div class="lg:w-10/12 xl:w-3/4">
						<h2 class="text-3xl font-semibold mb-5">Noob?</h2>

						<p class="w-full mb-10">
							Fill out the following form and one of our volunteer community members will add your
							location to the map.
						</p>

						<form on:submit={submitForm} class="space-y-5 w-full">
							<div>
								<label for="name" class="mb-2 block font-semibold">Merchant Name</label>
								<input
									type="text"
									name="name"
									placeholder="Satoshi's Comics"
									required
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={name}
								/>
							</div>
							<div>
								<label for="address" class="mb-2 block font-semibold">Address</label>
								<input
									type="text"
									name="address"
									placeholder="2100 Freedom Drive..."
									required
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={address}
								/>
							</div>
							<div>
								<label for="location" class="mb-2 block font-semibold"
									>Location URL <span class="font-normal">(optional)</span></label
								>
								<input
									type="url"
									name="location"
									placeholder="e.g. https://google.com/maps/..."
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={url}
								/>
							</div>

							<fieldset>
								<legend class="mb-2 block font-semibold">Select one or more options</legend>
								{#if noMethodSelected}
									<span class="text-error">Please fix this...</span>
								{/if}
								<div class="md:space-x-5 space-y-2 md:space-y-0">
									<div class="md:inline">
										<input
											type="checkbox"
											name="onchain"
											id="onchain"
											bind:this={onchain}
											on:click={handleCheckboxClick}
										/>
										<label for="onchain" class="ml-1 cursor-pointer"
											><i class="fa-brands fa-bitcoin" /> On-chain</label
										>
									</div>
									<div class="md:inline">
										<input
											type="checkbox"
											name="lightning"
											id="lightning"
											bind:this={lightning}
											on:click={handleCheckboxClick}
										/>
										<label for="lightning" class="ml-1 cursor-pointer"
											><i class="fa-solid fa-bolt" /> Lightning</label
										>
									</div>
									<div class="md:inline">
										<input
											type="checkbox"
											name="nfc"
											id="nfc"
											bind:this={nfc}
											on:click={handleCheckboxClick}
										/>
										<label for="nfc" class="ml-1 cursor-pointer"
											><i class="fa-solid fa-credit-card" /> NFC</label
										>
									</div>
								</div>
							</fieldset>

							<div>
								<label for="email" class="mb-2 block font-semibold"
									>Twitter handle <span class="font-normal">(optional)</span></label
								>
								<input
									type="type"
									name="twitter"
									placeholder="@BTCMapDotOrg"
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={twitter}
								/>
							</div>
							<div>
								<label for="notes" class="mb-2 block font-semibold"
									>Notes <span class="font-normal">(optional)</span></label
								>
								<textarea
									name="notes"
									placeholder="Any other relevant details? Website URL, business type etc."
									rows="5"
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={notes}
								/>
							</div>

							<PrimaryButton
								loading={submitting}
								disabled={submitting}
								text="Submit Location"
								style="w-full py-3 rounded-xl"
							/>
						</form>
					</div>
				</section>

				<section id="supercoder" class="mx-auto w-full md:w-2/3 lg:w-1/2 pt-14 lg:pt-0">
					<div class="lg:flex justify-end">
						<div class="lg:w-10/12 xl:w-3/4">
							<h2 class="text-3xl font-semibold mb-5 lg:text-right">Shadowy supertagger?</h2>
							<p class="w-full mb-10">
								Contribute changes directly to OSM - like a 😎 boss. Who needs forms anyway.
							</p>
							<img src="/images/supercoder.svg" alt="shadowy supercoder" class="mb-10 mx-auto" />
							<PrimaryButton
								text="See Wiki for instructions"
								link="https://github.com/teambtcmap/btcmap.org/wiki/Tagging-Instructions"
								style="w-full py-3 rounded-xl"
								external
							/>
						</div>
					</div>
				</section>
			</div>
		{:else}
			<div class="flex justify-center items-center text-center pb-20 md:pb-32 mt-10">
				<div>
					<h2 class="text-4xl font-semibold mb-5">Location Submitted!</h2>
					<p class="w-full md:w-[500px] mb-5">
						We’ll review your information and add it asap. If you wish to know the status of your
						contribution, join our <a
							href={$socials.discord}
							target="_blank"
							rel="noreferrer"
							class="text-link hover:text-hover">Discord channel</a
						>.
					</p>
					{#if typeof window !== 'undefined'}
						<div class="w-full md:w-96 mx-auto">
							<LottiePlayer
								src="/lottie/lightning-bolt.json"
								autoplay={true}
								loop={true}
								controls={false}
								renderer="svg"
								background="transparent"
							/>
						</div>
					{/if}
					<PrimaryButton
						text="Submit another location"
						link="/add-location"
						style="w-52 py-3 mx-auto mt-10 rounded-xl"
					/>
				</div>
			</div>
		{/if}

		<Footer />
	</div>
</div>
