<script>
	import { Header, Footer } from '$comp';
	import { socials, apps } from '$lib/store';
</script>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="space-y-10 mt-10 mb-20">
			<div class="text-body text-xl space-y-5">
				<h1 class="text-4xl md:text-5xl font-semibold text-primary !leading-tight">
					Privacy Policy
				</h1>
				<p>
					We <strong>do not</strong> collect your personal information.
				</p>
				<p>Please read further for more details.</p>
			</div>

			<div class="text-body text-xl space-y-5">
				<h2 class="text-primary text-3xl font-semibold">Forms</h2>
				<p>
					What happens when you submit an <a href="/add-location" class="text-link hover:text-hover"
						>Add Location</a
					>
					or
					<a href="/report-outdated-info" class="text-link hover:text-hover">Report Outdated Info</a
					> form:
				</p>
				<ol class="list-decimal space-y-2 ml-5">
					<li>
						An issue is automatically created on our <a
							href="https://github.com/teambtcmap/btcmap-data/issues"
							class="text-link hover:text-hover">btcmap-data</a
						> repo on GitHub containing the form information.
					</li>
					<li>
						A message is automatically sent in the <a
							href="https://discord.gg/sCBUzb4Qch"
							class="text-link hover:text-hover">data-feed</a
						> channel on our Discord containing the form information.
					</li>
					<li>
						If the submission is valid, it is added to <a
							href="https://www.openstreetmap.org"
							class="text-link hover:text-hover">OpenStreetMap</a
						> by a BTC Map contributor.
					</li>
				</ol>
				<p>
					Please refer to the privacy policies of each of these third parties to understand how your
					information is used there.
				</p>
				<ul class="list-disc space-y-2 ml-5">
					<li>
						<a
							href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
							class="text-link hover:text-hover">GitHub Privacy Policy</a
						>
					</li>
					<li>
						<a href="https://discord.com/privacy" class="text-link hover:text-hover"
							>Discord Privacy Policy</a
						>
					</li>
					<li>
						<a
							href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
							class="text-link hover:text-hover">OpenStreetMap Privacy Policy</a
						>
					</li>
				</ul>
				<p>
					By submitting information through one of the above mentioned forms you are agreeing to
					this information being used publicly.
				</p>
				<p><strong>Do not</strong> submit any personal or private information.</p>
				<p>
					If you include a Twitter handle, we may Tweet about your submission from the <a
						href={$socials.twitter}
						class="text-link hover:text-hover">@BTCMapDotOrg</a
					> Twitter account.
				</p>
			</div>

			<div class="text-body text-xl space-y-5">
				<h2 class="text-primary text-3xl font-semibold">Analytics</h2>
				<p>
					We use privacy respecting analytics provided by <a
						href="https://www.netlify.com/"
						class="text-link hover:text-hover">Netlify</a
					> in order to see activity on BTC Map. For example, how many users are visiting the website.
				</p>
				<p>
					These analytics are done server-side and do not use any JavaScript, cookies or trackers.
					There is no personally identifiable information included. All of the data is anonymous and
					complies with the <a
						href="https://www.netlify.com/gdpr-ccpa/"
						class="text-link hover:text-hover">GDPR</a
					>. This data is deleted after 30 days.
				</p>
				<p>Below are some links to read more about Netlify Analytics:</p>
				<ul class="list-disc space-y-2 ml-5">
					<li>
						<a href="https://www.netlify.com/products/analytics/" class="text-link hover:text-hover"
							>Netlify Analytics</a
						>
					</li>
					<li>
						<a
							href="https://docs.netlify.com/monitor-sites/analytics/"
							class="text-link hover:text-hover">Netlify Docs - Analytics</a
						>
					</li>
					<li>
						<a
							href="https://docs.netlify.com/monitor-sites/analytics/how-analytics-works/"
							class="text-link hover:text-hover">Netlify Docs - How Analytics Works</a
						>
					</li>
				</ul>
			</div>

			<div class="text-body text-xl space-y-5">
				<h2 class="text-primary text-3xl font-semibold">Cookies</h2>
				<p>We <strong>do not</strong> use cookies.</p>
			</div>

			<div class="text-body text-xl space-y-5">
				<h2 class="text-primary text-3xl font-semibold">(Don't Use) Google</h2>
				<p>
					Our Android app is available to download via the <a
						href={$apps.play}
						class="text-link hover:text-hover">Google Play Store</a
					>. However, we <strong>do not</strong> recommend using this method. God only knows what
					information is collected about you when using Google services. Instead, we have our
					Android app available for download directly from our GitHub repo as an
					<a href={$apps.direct} class="text-link hover:text-hover">APK</a>
					or on the FOSS app store
					<a href={$apps.fdroid} class="text-link hover:text-hover">F-Droid.</a>
				</p>
			</div>

			<div class="text-body text-xl space-y-5">
				<h2 class="text-primary text-3xl font-semibold">How to Protect Your IP Online</h2>
				<p>
					It is good practice to protect your public IP address when surfing the web. The two most
					common methods to do this are:
				</p>
				<ol class="list-decimal space-y-2 ml-5">
					<li>
						Use a VPN service like <a
							href="https://mullvad.net/en/"
							class="text-link hover:text-hover">Mullvad</a
						>.
					</li>
					<li>
						Use <a href="https://www.torproject.org/" class="text-link hover:text-hover">Tor</a> browser.
					</li>
				</ol>
			</div>

			<div class="text-body text-xl space-y-5">
				<h2 class="text-primary text-3xl font-semibold">Changes to this Privacy Policy</h2>
				<p>This privacy policy was last updated: October 7, 2022.</p>
			</div>

			<div class="text-body text-xl space-y-5">
				<h2 class="text-primary text-3xl font-semibold">Contact Us</h2>
				<p>
					If you have any questions or feedback about our privacy policy, please contact us at <a
						href="mailto:hello@btcmap.org"
						class="text-link hover:text-hover">hello@btcmap.org</a
					> or on any of our social platforms.
				</p>
			</div>
		</main>
		<Footer />
	</div>
</div>
