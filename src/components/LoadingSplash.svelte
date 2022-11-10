<script>
	export let page;

	import { LoadingSpinner } from '$comp';
</script>

<div class="bg-teal w-full">
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<div class="h-[100vh] w-full flex justify-center items-center">
			<main class="space-y-10">
				<a href="/">
					<img
						decoding="sync"
						fetchpriority="high"
						src="/images/logo.svg"
						alt="BTC Map"
						class="w-36 md:w-40 mx-auto"
					/>
				</a>
				<LoadingSpinner color="text-link" size="w-16 h-16" style="mx-auto" />
				<h1 class="text-primary font-semibold text-4xl md:text-5xl text-center">
					Loading {page}...
				</h1>
			</main>
		</div>
	</div>
</div>
