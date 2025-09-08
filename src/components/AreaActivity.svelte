<script lang="ts">
	import { LatestTagger, TaggerSkeleton, TopButton } from '$lib/comp';
	import { type ActivityEvent, type User } from '$lib/types.js';
	import { resolve } from '$app/paths';

	export let alias: string;
	export let name: string;
	export let dataInitialized: boolean;
	export let eventElements: ActivityEvent[];
	export let taggers: User[];

	let hideArrow = false;
	let activityDiv: HTMLDivElement;

	let eventCount = 25;
	$: eventElementsPaginated = eventElements.slice(0, eventCount);

	let taggerCount = 25;
	$: taggersPaginated = taggers.slice(0, taggerCount);
	let taggerDiv: HTMLDivElement;
</script>

<section id="taggers">
	<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
		<h3
			class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
		>
			{name || 'BTC Map Area'} Supertaggers
		</h3>

		<div bind:this={taggerDiv} class="hide-scroll max-h-[375px] overflow-scroll p-1">
			{#if taggers && taggers.length}
				<div class="flex flex-wrap items-center justify-center">
					{#each taggersPaginated as tagger (tagger.id)}
						<div class="m-4 space-y-1 transition-transform hover:scale-110">
							<a href={resolve(`/tagger/${tagger.id}`)}>
								<img
									src={tagger.osm_json.img
										? tagger.osm_json.img.href
										: '/images/satoshi-nakamoto.png'}
									alt="avatar"
									class="mx-auto h-20 w-20 rounded-full object-cover"
									on:error={function () {
										this.src = '/images/satoshi-nakamoto.png';
									}}
								/>
								<p class="text-center font-semibold text-body dark:text-white">
									{tagger.osm_json.display_name.length > 21
										? tagger.osm_json.display_name.slice(0, 18) + '...'
										: tagger.osm_json.display_name}
								</p>
							</a>
						</div>
					{/each}
				</div>

				{#if taggersPaginated.length !== taggers.length}
					<button
						class="mx-auto !mb-4 block text-xl font-semibold text-link transition-colors hover:text-hover"
						on:click={() => (taggerCount = taggerCount + 25)}>Load More</button
					>
				{/if}
			{:else if !dataInitialized}
				<div class="flex flex-wrap items-center justify-center">
					{#each Array(5) as _, index (index)}
						<div class="m-4 space-y-1 transition-transform hover:scale-110">
							<p class="mx-auto h-20 w-20 animate-pulse rounded-full bg-link/50" />
							<p class="mx-auto h-5 w-28 animate-pulse rounded bg-link/50" />
						</div>
					{/each}
				</div>
			{:else}
				<p class="p-5 text-center text-body dark:text-white">No supertaggers to display.</p>
			{/if}
		</div>
	</div>
</section>

<section id="activity">
	<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
		<h3
			class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
		>
			{name || 'BTC Map Area'} Activity
		</h3>

		<div
			bind:this={activityDiv}
			class="hide-scroll relative max-h-[375px] space-y-2 overflow-y-scroll"
			on:scroll={() => {
				if (dataInitialized && !hideArrow) {
					hideArrow = true;
				}
			}}
		>
			{#if eventElements && eventElements.length}
				{#each eventElementsPaginated as event (event['created_at'])}
					<LatestTagger
						location={event.location}
						action={event.type}
						user={event.tagger}
						time={event['created_at']}
						latest={event === eventElements[0] ? true : false}
						merchantId={event.merchantId}
					/>
				{/each}

				{#if eventElementsPaginated.length !== eventElements.length}
					<button
						class="mx-auto !mb-5 block text-xl font-semibold text-link transition-colors hover:text-hover"
						on:click={() => (eventCount = eventCount + 25)}>Load More</button
					>
				{:else if eventElements.length > 10}
					<TopButton scroll={activityDiv} style="!mb-5" />
				{/if}

				{#if !hideArrow && eventElements.length > 5}
					<svg
						class="absolute bottom-4 left-[calc(50%-8px)] z-20 h-4 w-4 animate-bounce text-primary dark:text-white"
						fill="currentColor"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 512 512"
						><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
							d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
						/></svg
					>
				{/if}
			{:else if !dataInitialized}
				{#each Array(5) as _, index (index)}
					<TaggerSkeleton />
				{/each}
			{:else}
				<p class="p-5 text-body dark:text-white">No activity to display.</p>
			{/if}
		</div>
	</div>
</section>

<section id="atom">
	<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
		<h3
			class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
		>
			{name || 'BTC Map Area'} Atom Feeds
		</h3>

		<ul class="space-y-5 p-5 text-lg font-semibold text-primary dark:text-white">
			<li>
				<a
					class="text-link transition-colors hover:text-hover"
					href="https://api.btcmap.org/feeds/new-places/{alias}"
					target="_blank"
					rel="noreferrer"
				>
					New Places
				</a>
				<i class="fa-solid fa-location-pin ml-1" />
			</li>
			<li>
				<a
					class="text-link transition-colors hover:text-hover"
					href="https://api.btcmap.org/feeds/new-comments/{alias}"
					target="_blank"
					rel="noreferrer"
				>
					New Comments
				</a>
				<i class="fa-solid fa-comment ml-1"></i>
			</li>
		</ul>
	</div>
</section>
