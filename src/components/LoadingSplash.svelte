<script>
	export let page;

	import { LoadingSpinner } from '$comp';
</script>

<div class="w-full bg-teal">
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
				<h1 class="text-center text-4xl font-semibold text-primary md:text-5xl">
					Loading {page}...
				</h1>
			</main>
		</div>
	</div>
</div>
