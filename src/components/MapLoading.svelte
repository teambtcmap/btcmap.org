<script>
	export let type;
	export let message = undefined;
	export let style;

	import { LottiePlayer } from '@lottiefiles/svelte-lottie-player';
	import { LoadingSpinner } from '$comp';
</script>

{#if type === 'main'}
	<div class="w-full bg-teal dark:bg-dark {style}">
		<div class="mx-auto w-10/12 xl:w-[1200px]">
			<div class="flex h-[100vh] w-full items-center justify-center">
				<main class="space-y-10">
					{#if typeof window !== 'undefined'}
						<div class="mx-auto w-52">
							<LottiePlayer
								src="/lottie/loading.json"
								autoplay={true}
								loop={true}
								controls={false}
								renderer="svg"
								background="transparent"
							/>
						</div>
					{/if}
					<h1 class="text-center text-4xl font-semibold text-primary dark:text-white md:text-5xl">
						{message}
					</h1>
				</main>
			</div>
		</div>
	</div>
{:else if type === 'embed'}
	<div
		class="w-full {style} absolute left-0 top-0 z-[10000] flex items-center justify-center bg-teal dark:bg-dark"
	>
		<div class="space-y-6">
			<LoadingSpinner color="text-link" />
			<p class="text-center font-semibold text-primary dark:text-white">Rendering map...</p>
		</div>
	</div>
{/if}
