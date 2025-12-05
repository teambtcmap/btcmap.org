<script lang="ts">
	import { socials } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map - Privacy Policy</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - Privacy Policy" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<main class="mt-10 mb-20 space-y-10">
	<div class="space-y-5 text-xl text-body dark:text-white">
		<h1 class="text-4xl !leading-tight font-semibold text-primary md:text-5xl dark:text-white">
			Privacy Policy
		</h1>
		<p>
			We <strong>do not</strong> collect your personal information.
		</p>
		<p>Please read further for more details.</p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">Forms</h2>
		<p>What happens when you submit a form on our website:</p>
		<ol class="ml-5 list-decimal space-y-2">
			<li>
				An issue is automatically created in our self-hosted <a
					href="https://gitea.btcmap.org/teambtcmap/btcmap-data/issues/"
					class="text-link transition-colors hover:text-hover">btcmap-data</a
				> repo containing the form information.
			</li>
			<li>
				A message is automatically sent in the <a
					href="https://discord.gg/p8hj6SVx9X"
					class="text-link transition-colors hover:text-hover">github-data</a
				> channel on our Discord containing the form information.
			</li>
			<li>
				If the submission is valid, it is added to <a
					href="https://www.openstreetmap.org"
					class="text-link transition-colors hover:text-hover">OpenStreetMap</a
				> by a BTC Map contributor and will appear in our apps.
			</li>
			<li>
				Some information including communities is not stored on OpenStreetMap but in the BTC Map
				database instead.
			</li>
		</ol>
		<p>
			Please refer to the privacy policies of each of these third parties to understand how your
			information is used there.
		</p>
		<ul class="ml-5 list-disc space-y-2">
			<li>
				<a
					href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
					class="text-link transition-colors hover:text-hover">GitHub Privacy Policy</a
				>
			</li>
			<li>
				<a href="https://discord.com/privacy" class="text-link transition-colors hover:text-hover"
					>Discord Privacy Policy</a
				>
			</li>
			<li>
				<a
					href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
					class="text-link transition-colors hover:text-hover">OpenStreetMap Privacy Policy</a
				>
			</li>
		</ul>
		<p>
			By submitting information through one of our forms you are agreeing that this information will
			be used publicly.
		</p>
		<p><strong>Do not</strong> submit any personal or private information.</p>
		<p>
			If you include an X handle, we may post about your submission from the
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={$socials.x} class="text-link transition-colors hover:text-hover">@btcmap</a>
			X account.
		</p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">Analytics</h2>
		<p>
			We use privacy respecting analytics provided by <a
				href="https://www.netlify.com/"
				class="text-link transition-colors hover:text-hover"
			>
				Netlify
			</a> in order to see activity on BTC Map. For example, how many users are visiting the website and
			the performance.
		</p>
		<p>
			These analytics do not use any cookies or trackers. There is no personally identifiable
			information included. All of the data is anonymous and complies with the <a
				href="https://www.netlify.com/gdpr-ccpa/"
				class="text-link transition-colors hover:text-hover"
			>
				GDPR
			</a>. This data is deleted after 30 days.
		</p>
		<p>Below are some links to read more about Netlify Analytics:</p>
		<ul class="ml-5 list-disc space-y-2">
			<li>
				<a
					href="https://www.netlify.com/products/analytics/"
					class="text-link transition-colors hover:text-hover">Netlify Analytics</a
				>
			</li>
			<li>
				<a
					href="https://docs.netlify.com/monitor-sites/analytics/"
					class="text-link transition-colors hover:text-hover">Netlify Docs - Analytics</a
				>
			</li>
			<li>
				<a
					href="https://docs.netlify.com/monitor-sites/analytics/how-analytics-works/"
					class="text-link transition-colors hover:text-hover">Netlify Docs - How Analytics Works</a
				>
			</li>
		</ul>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">Cookies</h2>
		<p>We <strong>do not</strong> use cookies.</p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">
			How to Protect Your IP Online
		</h2>
		<p>
			It is good practice to protect your public IP address when surfing the web. The two most
			common methods to do this are:
		</p>
		<ol class="ml-5 list-decimal space-y-2">
			<li>
				Use a VPN service like <a
					href="https://mullvad.net/en/"
					class="text-link transition-colors hover:text-hover">Mullvad</a
				>.
			</li>
			<li>
				Use <a
					href="https://www.torproject.org/"
					class="text-link transition-colors hover:text-hover">Tor</a
				> browser.
			</li>
		</ol>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">
			Changes to this Privacy Policy
		</h2>
		<p>This privacy policy was last updated: July 10, 2023.</p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">Contact Us</h2>
		<p>
			If you have any questions or feedback about our privacy policy, please contact us at <a
				href="mailto:hello@btcmap.org"
				class="text-link transition-colors hover:text-hover"
			>
				hello@btcmap.org
			</a> or on any of our social platforms.
		</p>
	</div>
</main>
