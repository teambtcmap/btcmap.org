<script>
	export let type;
	export let message = undefined;
	export let style;

	import { LoadingSpinner } from '$comp';
</script>

{#if type === 'main'}
	<div class="w-full bg-teal {style}">
		<div class="mx-auto w-10/12 xl:w-[1200px]">
			<div class="flex h-[100vh] w-full items-center justify-center">
				<main class="space-y-10">
					<a href="/">
						<img
							decoding="sync"
							fetchpriority="high"
							src="/images/logo.svg"
							alt="BTC Map"
							class="mx-auto w-36 md:w-40"
						/>
					</a>
					<LoadingSpinner color="text-link" size="w-16 h-16" style="mx-auto" />
					<h1 class="text-center text-4xl font-semibold text-primary md:text-5xl">{message}</h1>
				</main>
			</div>
		</div>
	</div>
{:else if type === 'embed'}
	<div
		class="w-full {style} absolute top-0 left-0 z-[10000] flex items-center justify-center bg-teal"
	>
		<div class="space-y-6">
			<LoadingSpinner color="text-link" />
			<p class="text-center font-semibold text-primary">Rendering map...</p>
		</div>
	</div>
{/if}
