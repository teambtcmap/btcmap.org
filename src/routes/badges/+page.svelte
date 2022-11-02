<script>
	import { Header, Footer, BadgeCard } from '$comp';

	let achievements = [
		{
			title: 'Top Tagger',
			desc: '#1 on the leaderboard',
			icon: 'top-tagger'
		},
		{
			title: 'Podium',
			desc: 'In the top 3 on the leaderboard',
			icon: 'podium'
		},
		{
			title: 'High Rank',
			desc: 'In the top 10 on the leaderboard',
			icon: 'high-rank'
		},
		{
			title: 'OG Supertagger',
			desc: 'Contribute to BTC Map within the first 3 months',
			icon: 'og-supertagger'
		},
		{
			title: 'Lightning Junkie',
			desc: 'Add a tip button to your profile',
			icon: 'lightning-junkie'
		},
		{
			title: 'Hello World',
			desc: 'Add an avatar to your profile',
			icon: 'hello-world'
		},
		{
			title: 'Demolition Specialist',
			desc: 'The majority of your contributions are deletions',
			icon: 'demolition-specialist'
		},
		{
			title: 'Update Maxi',
			desc: 'The majority of your contributions are updates',
			icon: 'update-maxi'
		},
		{
			title: 'Creator',
			desc: 'The majority of your contributions are creations',
			icon: 'creator'
		},
		{
			title: 'Supporter',
			desc: 'Make an annual donation to BTC Map',
			icon: 'supporter'
		}
	];

	let contributions = [
		{
			title: 'Hyperbitcoinisation',
			desc: '21M',
			icon: 'hyperbitcoinisation'
		},
		{
			title: 'Pizza Time',
			desc: '10K',
			icon: 'pizza-time'
		},
		{
			title: 'Godly',
			desc: '7777',
			icon: 'godly'
		},
		{
			title: 'Shadow',
			desc: '5000',
			icon: 'shadow'
		},
		{
			title: 'Whitepaper',
			desc: '3110',
			icon: 'whitepaper'
		},
		{
			title: 'Winston',
			desc: '1984',
			icon: 'winston'
		},
		{
			title: 'Whale',
			desc: '1000',
			icon: 'whale'
		},
		{
			title: 'Infinity',
			desc: '821',
			icon: 'infinity'
		},
		{
			title: 'Legend',
			desc: '500',
			icon: 'legend'
		},
		{
			title: 'Chancellor',
			desc: '301',
			icon: 'chancellor'
		},
		{
			title: 'SHA',
			desc: '256',
			icon: 'sha'
		},
		{
			title: 'No Bailouts',
			desc: '210',
			icon: 'no-bailouts'
		},
		{
			title: 'Supertagger',
			desc: '100',
			icon: 'supertagger'
		},
		{
			title: 'ATH',
			desc: '69',
			icon: 'ath'
		},
		{
			title: 'Longest Chain',
			desc: '51',
			icon: 'longest-chain'
		},
		{
			title: 'Satoshi',
			desc: '21',
			icon: 'satoshi'
		},
		{
			title: 'Heartbeat',
			desc: '10',
			icon: 'heartbeat'
		},
		{
			title: 'Segwit',
			desc: '4',
			icon: 'segwit'
		},
		{
			title: 'Whole Tagger',
			desc: '1',
			icon: 'whole-tagger'
		}
	];
</script>

<svelte:head>
	<title>BTC Map - Badges</title>
	<meta property="og:image" content="https://btcmap.org/images/og/leader.png" />
	<meta property="twitter:title" content="BTC Map - Badges" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/leader.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center my-10 md:my-20">
			<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight mb-8">
				Badges
			</h1>

			<p class="text-primary text-lg w-full lg:w-[700px] mx-auto">
				You can earn badges for your BTC Map contributions that will be displayed on your profile.
				Have a badge idea? Let us know!
			</p>

			<section id="achievements" class="space-y-8 mt-16 mb-20">
				<h2 class="text-primary text-3xl font-semibold text-center">Achievements</h2>

				<div class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
					{#each achievements.reverse() as achievement}
						<BadgeCard
							icon={achievement.icon}
							title={achievement.title}
							desc={achievement.desc}
							type="achievement"
						/>
					{/each}
				</div>
			</section>

			<section id="contributions" class="space-y-8">
				<h2 class="text-primary text-3xl font-semibold text-center">Contributions</h2>

				<div class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
					{#each contributions.reverse() as contribution}
						<BadgeCard
							icon={contribution.icon}
							title={contribution.title}
							desc={contribution.desc}
							type="contribution"
						/>
					{/each}
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>