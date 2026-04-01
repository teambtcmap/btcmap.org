<script lang="ts">
import { _ } from "$lib/i18n";
import { socials } from "$lib/store";

const linkClass = "text-link transition-colors hover:text-hover";
</script>

<svelte:head>
	<title>BTC Map - {$_("privacyPolicy.title")}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta name="twitter:title" content="BTC Map - {$_("privacyPolicy.title")}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="mt-10 mb-20 space-y-10">
	<div class="space-y-5 text-xl text-body dark:text-white">
		<h1 class="text-4xl !leading-tight font-semibold text-primary md:text-5xl dark:text-white">
			{$_("privacyPolicy.title")}
		</h1>
		<p>
			<strong>{$_("privacyPolicy.intro")}</strong>
		</p>
		<p>{$_("privacyPolicy.readMore")}</p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">{$_("privacyPolicy.forms.heading")}</h2>
		<p>{$_("privacyPolicy.forms.intro")}</p>
		<ol class="ml-5 list-decimal space-y-2">
			<li>
				{@html $_("privacyPolicy.forms.item1", {
					values: {
						btcmapDataLink: `<a href="https://gitea.btcmap.org/teambtcmap/btcmap-data/issues/" class="${linkClass}">btcmap-data</a>`
					}
				})}
			</li>
			<li>
				{@html $_("privacyPolicy.forms.item2", {
					values: {
						matrixLink: `<a href="https://matrix.to/#/#btcmap:matrix.org" class="${linkClass}">Matrix Space</a>`
					}
				})}
			</li>
			<li>
				{@html $_("privacyPolicy.forms.item3", {
					values: {
						osmLink: `<a href="https://www.openstreetmap.org" class="${linkClass}">OpenStreetMap</a>`
					}
				})}
			</li>
			<li>
				{$_("privacyPolicy.forms.item4")}
			</li>
		</ol>
		<p>
			{$_("privacyPolicy.forms.referPolicies")}
		</p>
		<ul class="ml-5 list-disc space-y-2">
			<li>
				<a
					href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
					class={linkClass}>{$_("privacyPolicy.links.githubPrivacy")}</a
				>
			</li>
			<li>
				<a href="https://discord.com/privacy" class={linkClass}
					>{$_("privacyPolicy.links.discordPrivacy")}</a
				>
			</li>
			<li>
				<a
					href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
					class={linkClass}>{$_("privacyPolicy.links.osmPrivacy")}</a
				>
			</li>
		</ul>
		<p>
			{$_("privacyPolicy.forms.agreePublic")}
		</p>
		<p><strong>{$_("privacyPolicy.forms.doNotSubmit")}</strong></p>
		<p>
			{$_("privacyPolicy.forms.xHandleBefore")}
			<a href={$socials.x} class={linkClass}>@btcmap</a>
			{$_("privacyPolicy.forms.xHandleAfter")}
		</p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">{$_("privacyPolicy.analytics.heading")}</h2>
		<p>
			{@html $_("privacyPolicy.analytics.intro", {
				values: {
					netlifyLink: `<a href="https://www.netlify.com/" class="${linkClass}">Netlify</a>`,
					umamiLink: `<a href="https://umami.is/" class="${linkClass}">Umami</a>`
				}
			})}
		</p>
		<p>
			{@html $_("privacyPolicy.analytics.noCookies", {
				values: {
					gdprLink: `<a href="https://www.netlify.com/gdpr-ccpa/" class="${linkClass}">GDPR</a>`
				}
			})}
		</p>
		<p>{$_("privacyPolicy.analytics.readMore")}</p>
		<ul class="ml-5 list-disc space-y-2">
			<li>
				<a
					href="https://www.netlify.com/products/analytics/"
					class={linkClass}>{$_("privacyPolicy.links.netlifyAnalytics")}</a
				>
			</li>
			<li>
				<a
					href="https://docs.netlify.com/monitor-sites/analytics/"
					class={linkClass}>{$_("privacyPolicy.links.netlifyDocsAnalytics")}</a
				>
			</li>
			<li>
				<a
					href="https://docs.netlify.com/monitor-sites/analytics/how-analytics-works/"
					class={linkClass}>{$_("privacyPolicy.links.netlifyDocsHowAnalytics")}</a
				>
			</li>
		</ul>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">{$_("privacyPolicy.cookies.heading")}</h2>
		<p><strong>{$_("privacyPolicy.cookies.intro")}</strong></p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">
			{$_("privacyPolicy.ipProtection.heading")}
		</h2>
		<p>
			{$_("privacyPolicy.ipProtection.intro")}
		</p>
		<ol class="ml-5 list-decimal space-y-2">
			<li>
				{@html $_("privacyPolicy.ipProtection.item1", {
					values: {
						mullvadLink: `<a href="https://mullvad.net/en/" class="${linkClass}">Mullvad</a>`
					}
				})}
			</li>
			<li>
				{@html $_("privacyPolicy.ipProtection.item2", {
					values: {
						torLink: `<a href="https://www.torproject.org/" class="${linkClass}">Tor</a>`
					}
				})}
			</li>
		</ol>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">
			{$_("privacyPolicy.changes.heading")}
		</h2>
		<p>{$_("privacyPolicy.changes.lastUpdated")}</p>
	</div>

	<div class="space-y-5 text-xl text-body dark:text-white">
		<h2 class="text-3xl font-semibold text-primary dark:text-white">{$_("privacyPolicy.contact.heading")}</h2>
		<p>
			{@html $_("privacyPolicy.contact.intro", {
				values: {
					contactLink: `<a href="mailto:hello@btcmap.org" class="${linkClass}">hello@btcmap.org</a>`
				}
			})}
		</p>
	</div>
</div>
