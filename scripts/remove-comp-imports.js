#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Component name to file path mapping (extracted from comp.ts)
const componentMap = {
	AboutCommunity: '../components/AboutCommunity.svelte',
	AboutContributor: '../components/AboutContributor.svelte',
	AboutCore: '../components/AboutCore.svelte',
	AboutIntegration: '../components/AboutIntegration.svelte',
	AboutMerchant: '../components/AboutMerchant.svelte',
	AboutPlus: '../components/AboutPlus.svelte',
	AboutTagger: '../components/AboutTagger.svelte',
	AppCard: '../components/AppCard.svelte',
	AreaActivity: '../components/AreaActivity.svelte',
	AreaLeaderboard: '../components/leaderboard/AreaLeaderboard.svelte',
	AreaLeaderboardItemName: '../components/leaderboard/AreaLeaderboardItemName.svelte',
	AreaMap: '../components/AreaMap.svelte',
	AreaMerchantHighlights: '../components/AreaMerchantHighlights.svelte',
	AreaPage: '../components/AreaPage.svelte',
	AreaStats: '../components/AreaStats.svelte',
	AreaTickets: '../components/AreaTickets.svelte',
	BadgeCard: '../components/BadgeCard.svelte',
	Boost: '../components/Boost.svelte',
	BoostButton: '../components/BoostButton.svelte',
	Breadcrumbs: '../components/Breadcrumbs.svelte',
	Card: '../components/Card.svelte',
	CloseButton: '../components/CloseButton.svelte',
	CommentAdd: '../components/CommentAdd.svelte',
	CommentAddButton: '../components/CommentAddButton.svelte',
	CommunityCard: '../components/CommunityCard.svelte',
	CommunitySection: '../components/CommunitySection.svelte',
	CommunitySkeleton: '../components/CommunitySkeleton.svelte',
	CopyButton: '../components/CopyButton.svelte',
	Countdown: '../components/Countdown.svelte',
	CountryCard: '../components/CountryCard.svelte',
	CountrySection: '../components/CountrySection.svelte',
	CountrySkeleton: '../components/CountrySkeleton.svelte',
	DashboardStat: '../components/DashboardStat.svelte',
	DonationOption: '../components/DonationOption.svelte',
	Footer: '../components/Footer.svelte',
	FormSuccess: '../components/FormSuccess.svelte',
	Header: '../components/Header.svelte',
	HeaderPlaceholder: '../components/HeaderPlaceholder.svelte',
	Icon: '../components/Icon.svelte',
	InfoTooltip: '../components/InfoTooltip.svelte',
	InvoicePayment: '../components/InvoicePayment.svelte',
	InvoicePaymentStage: '../components/InvoicePaymentStage.svelte',
	IssueCell: '../components/IssueCell.svelte',
	IssueIcon: '../components/IssueIcon.svelte',
	IssuesTable: '../components/IssuesTable.svelte',
	LatestTagger: '../components/LatestTagger.svelte',
	LeaderboardItem: '../components/LeaderboardItem.svelte',
	LeaderboardSkeleton: '../components/LeaderboardSkeleton.svelte',
	LoadingSpinner: '../components/LoadingSpinner.svelte',
	MapLoadingEmbed: '../components/MapLoadingEmbed.svelte',
	MapLoadingMain: '../components/MapLoadingMain.svelte',
	MerchantButton: '../components/MerchantButton.svelte',
	MerchantCard: '../components/MerchantCard.svelte',
	MerchantComment: '../components/MerchantComment.svelte',
	MerchantDrawerHash: '../components/MerchantDrawerHash.svelte',
	MerchantEvent: '../components/MerchantEvent.svelte',
	MerchantLink: '../components/MerchantLink.svelte',
	NavDropdownDesktop: '../components/NavDropdownDesktop.svelte',
	NavDropdownMobile: '../components/NavDropdownMobile.svelte',
	OpenTicket: '../components/OpenTicket.svelte',
	OpenTicketSkeleton: '../components/OpenTicketSkeleton.svelte',
	OrgBadge: '../components/OrgBadge.svelte',
	PaymentMethodIcon: '../components/PaymentMethodIcon.svelte',
	PrimaryButton: '../components/PrimaryButton.svelte',
	ProfileActivity: '../components/ProfileActivity.svelte',
	ProfileStat: '../components/ProfileStat.svelte',
	ShowTags: '../components/ShowTags.svelte',
	SocialLink: '../components/SocialLink.svelte',
	Socials: '../components/Socials.svelte',
	SponsorBadge: '../components/SponsorBadge.svelte',
	SupportSection: '../components/SupportSection.svelte',
	TaggerSkeleton: '../components/TaggerSkeleton.svelte',
	TaggingIssues: '../components/TaggingIssues.svelte',
	ThemeToggle: '../components/ThemeToggle.svelte',
	TicketLabel: '../components/TicketLabel.svelte',
	Tip: '../components/Tip.svelte',
	TopButton: '../components/TopButton.svelte',
	GradeTable: 'GradeTable' // Special case: not a component, it's a const
};

// Calculate relative path from importing file to component
function getRelativePath(fromFile, toComponentPath) {
	// Handle GradeTable special case
	if (toComponentPath === 'GradeTable') {
		return '$lib/comp'; // Keep GradeTable import from comp
	}

	// Convert component path to $lib path
	// ../components/Icon.svelte -> $lib/components/Icon.svelte
	// ../components/leaderboard/AreaLeaderboard.svelte -> $lib/components/leaderboard/AreaLeaderboard.svelte
	const libPath = toComponentPath.replace('../', '');

	return `$lib/${libPath}`;
}

function replaceImports(filePath) {
	let content = fs.readFileSync(filePath, 'utf8');
	let modified = false;

	// Match: import { ComponentA, ComponentB, ... } from '$lib/comp';
	const regex = /import\s+\{([^}]+)\}\s+from\s+['"](\$lib\/comp)['"]/g;

	const matches = [...content.matchAll(regex)];

	if (matches.length === 0) {
		return false; // No changes needed
	}

	content = content.replace(regex, (match, components) => {
		modified = true;
		const componentList = components
			.split(',')
			.map((c) => c.trim())
			.filter((c) => c.length > 0);

		// Generate direct imports for each component
		const directImports = componentList.map((comp) => {
			const componentPath = componentMap[comp];

			if (!componentPath) {
				console.warn(`⚠️  Unknown component: ${comp} in ${filePath}`);
				return `// TODO: Unknown component ${comp} - manual fix needed`;
			}

			// Handle GradeTable (keep it as $lib/comp import for now)
			if (comp === 'GradeTable') {
				return `import { GradeTable } from '$lib/comp';`;
			}

			const importPath = getRelativePath(filePath, componentPath);
			return `import ${comp} from '${importPath}';`;
		});

		return directImports.join('\n');
	});

	if (modified) {
		fs.writeFileSync(filePath, content, 'utf8');
		console.log(`✅ Updated: ${filePath}`);
		return true;
	}

	return false;
}

async function main() {
	console.log('🚀 Starting comp.ts import replacement...\n');

	const args = process.argv.slice(2);
	const phaseFlag = args.find((arg) => arg.startsWith('--phase='));
	const dryRun = args.includes('--dry-run');

	let patterns = [];

	if (phaseFlag) {
		const phase = phaseFlag.split('=')[1];
		console.log(`📍 Running Phase ${phase}\n`);

		switch (phase) {
			case '1':
				// Critical performance pages
				patterns = [
					'src/routes/map/+page.svelte',
					'src/routes/merchant/[id]/+page.svelte',
					'src/routes/+page.svelte',
					'src/routes/communities/map/+page.svelte'
				];
				console.log('🎯 Phase 1: Critical Performance Pages');
				break;
			case '2':
				// Components that import from comp.ts
				patterns = ['src/components/**/*.svelte'];
				console.log('🎯 Phase 2: Component Internal Imports');
				break;
			case '3':
				// All remaining routes
				patterns = ['src/routes/**/*.svelte'];
				console.log('🎯 Phase 3: Remaining Route Pages');
				break;
			default:
				console.error('❌ Invalid phase. Use --phase=1, --phase=2, or --phase=3');
				process.exit(1);
		}
	} else {
		// Default: process all files
		patterns = ['src/**/*.{svelte,ts}'];
		console.log('🎯 Processing all files');
	}

	console.log(`${dryRun ? '🔍 DRY RUN MODE - No files will be modified' : ''}\n`);

	let totalFiles = 0;
	let modifiedFiles = 0;

	for (const pattern of patterns) {
		const files = await glob(pattern, { nodir: true });

		for (const file of files) {
			// Skip comp.ts itself
			if (file.includes('comp.ts')) continue;

			totalFiles++;

			if (dryRun) {
				const content = fs.readFileSync(file, 'utf8');
				if (content.includes("from '$lib/comp'")) {
					console.log(`📄 Would update: ${file}`);
					modifiedFiles++;
				}
			} else {
				const wasModified = replaceImports(file);
				if (wasModified) modifiedFiles++;
			}
		}
	}

	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log(`📊 Summary:`);
	console.log(`   Files scanned: ${totalFiles}`);
	console.log(`   Files ${dryRun ? 'to update' : 'updated'}: ${modifiedFiles}`);
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	if (!dryRun && modifiedFiles > 0) {
		console.log('✨ Done! Next steps:');
		console.log('   1. Run: yarn format');
		console.log('   2. Run: yarn typecheck');
		console.log('   3. Test the pages manually');
		console.log('   4. Commit changes\n');
	}
}

main().catch((error) => {
	console.error('❌ Error:', error);
	process.exit(1);
});
