<script>
	export let type;
	export let message;
	export let style;

	import { LoadingSpinner } from '$comp';
</script>

{#if type === 'main'}
	<div class="bg-teal w-full {style}">
		<div class="w-10/12 xl:w-[1200px] mx-auto">
			<div class="h-[100vh] w-full flex justify-center items-center">
				<main class="space-y-12">
					<a href="/">
						<img
							decoding="sync"
							fetchpriority="high"
							src="/images/logo.svg"
							alt="BTC Map"
							class="w-36 md:w-40 mx-auto"
						/>
					</a>
					<h1 class="text-primary font-semibold text-4xl md:text-5xl text-center">{message}</h1>
				</main>
			</div>
		</div>
	</div>
{:else if type === 'embed'}
	<div
		class="w-full {style} absolute top-0 left-0 z-[10000] bg-teal border-2 border-input rounded-2xl flex justify-center items-center"
	>
		<div class="space-y-6">
			<LoadingSpinner color="text-link" />
			<p class="text-primary font-semibold text-center">Rendering map...</p>
		</div>
	</div>
{/if}
