<script>
	export let page;

	import { LottiePlayer } from '@lottiefiles/svelte-lottie-player';
</script>

<div class="w-full bg-teal">
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<div class="flex h-[100vh] w-full items-center justify-center">
			<main class="space-y-10 text-center">
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
				<h1 class="text-4xl font-semibold text-primary md:text-5xl">
					Loading {page}...
				</h1>
				<a
					href="/"
					class="inline-block text-xl font-semibold text-link transition-colors hover:text-hover"
					><i class="fa-solid fa-house mr-2" /> Home</a
				>
			</main>
		</div>
	</div>
</div>
