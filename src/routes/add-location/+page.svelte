<script>
	import { Header, Footer, PrimaryButton } from '$comp';

	let onchain;
	let lightning;
	let nfc;
	let noMethodSelected = false;

	const handleCheckboxClick = () => {
		noMethodSelected = false;
	};

	const submitForm = (e) => {
		e.preventDefault();

		if (!onchain.checked && !lightning.checked && !nfc.checked) {
			noMethodSelected = true;
		}
	};
</script>

<div class="bg-teal">
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<Header />

		<div class="space-x-4 mt-10">
			<a href="/" class="text-link hover:text-hover font-semibold"
				><i class="fa-solid fa-house mr-2" /> Home</a
			> <i class="fa-solid fa-chevron-right text-grey" />
			<span class="font-semibold">Add a location</span>
		</div>

		<h1 class="text-4xl md:text-5xl font-semibold mt-8 text-center lg:text-left">Add a location</h1>

		<div class="mt-16 pb-20 md:pb-32 lg:flex justify-between">
			<section
				id="noob"
				class="mx-auto w-full md:w-2/3 lg:w-1/2 border-b lg:border-b-0 pb-14 lg:pb-0 lg:border-r border-input"
			>
				<h2 class="text-3xl font-semibold mb-5">Noob?</h2>
				<p class="w-full md:w-[300px] mb-10">
					Fill out the following form and one of our volunteer community members will add your
					location to the map.
				</p>

				<form on:submit={submitForm} class="space-y-5 w-full lg:w-10/12 xl:w-3/4">
					<div>
						<label for="name" class="mb-2 block font-semibold">Merchant Name</label>
						<input
							type="text"
							name="name"
							placeholder="Satoshi's Comics"
							required
							class="focus:outline-none border-2 border-input rounded-2xl p-3 w-full"
						/>
					</div>
					<div>
						<label for="address" class="mb-2 block font-semibold">Address</label>
						<input
							type="text"
							name="address"
							placeholder="2100 Freedom Drive..."
							required
							class="focus:outline-none border-2 border-input rounded-2xl p-3 w-full"
						/>
					</div>
					<div>
						<label for="location" class="mb-2 block font-semibold">Location URL</label>
						<input
							type="url"
							name="location"
							placeholder="e.g. https://google.com/maps/..."
							required
							class="focus:outline-none border-2 border-input rounded-2xl p-3 w-full"
						/>
					</div>

					<div>
						<label for="type" class="mb-2 block font-semibold">Business Type</label>
						<select name="type" required class="focus:outline-none py-1 w-full">
							<option value="">Please select an option</option>
							<option value="cafe">Cafe</option>
							<option value="restaurant">Restaurant</option>
							<option value="fastfood">Fast Food</option>
							<option value="bar">Bar</option>
							<option value="supermarket">Supermarket</option>
							<option value="other">Other</option>
						</select>
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
									bind:this={onchain}
									on:click={handleCheckboxClick}
								/>
								<label for="onchain" class="ml-1"><i class="fa-brands fa-bitcoin" /> On-chain</label
								>
							</div>
							<div class="md:inline">
								<input
									type="checkbox"
									name="lightning"
									bind:this={lightning}
									on:click={handleCheckboxClick}
								/>
								<label for="lightning" class="ml-1"><i class="fa-solid fa-bolt" /> Lightning</label>
							</div>
							<div class="md:inline">
								<input type="checkbox" name="nfc" bind:this={nfc} on:click={handleCheckboxClick} />
								<label for="nfc" class="ml-1"><i class="fa-solid fa-credit-card" /> NFC</label>
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
							class="focus:outline-none border-2 border-input rounded-2xl p-3 w-full"
						/>
					</div>
					<div>
						<label for="notes" class="mb-2 block font-semibold"
							>Notes <span class="font-normal">(optional)</span></label
						>
						<textarea
							name="notes"
							placeholder="Any other relevant details? Website URL etc."
							rows="5"
							class="focus:outline-none border-2 border-input rounded-2xl p-3 w-full"
						/>
					</div>

					<PrimaryButton text="Submit Location" style="w-full py-3" />
				</form>
			</section>

			<section id="supercoder" class="mx-auto w-full md:w-2/3 lg:w-1/2 pt-14 lg:pt-0">
				<div class="lg:flex justify-end">
					<div>
						<h2 class="text-3xl font-semibold mb-5">Shadowy supercoder?</h2>
						<p class="w-full md:w-[325px] mb-10">
							Contribute changes directly to OSM - like a 😎 boss. Who needs forms anyway.
						</p>
						<img src="/images/supercoder.png" alt="shadowy supercoder" class="mb-10 mx-auto" />
						<PrimaryButton
							text="See Wiki for instructions"
							link="https://github.com/teambtcmap/btcmap.org/wiki/Tagging-Instructions"
							style="w-full py-3"
							external
						/>
					</div>
				</div>
			</section>
		</div>

		<Footer />
	</div>
</div>
