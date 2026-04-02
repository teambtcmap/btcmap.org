export type Platform = "android" | "ios" | "web" | "linux" | "windows" | "mac";

export type StoreKey =
	| "app-store"
	| "apk"
	| "f-droid"
	| "google-play"
	| "linux-package"
	| "obtainium"
	| "play"
	| "web"
	| "zapstore";

export type AppTag = "btcmap" | "powered-by-btcmap" | "coming-soon";

export type AppStoreEntry = {
	store: StoreKey;
	platform: Platform;
	url: string;
};

export type AppConfig = {
	id: string;
	name: string;
	// path in /static, e.g. '/images/apps/btcmap.png'
	logo: string;
	tag: AppTag;
	sponsor: boolean;
	stores: AppStoreEntry[];
};

export const appConfigs: AppConfig[] = [
	{
		id: "btcmap-android",
		name: "BTC Map",
		logo: "/images/apps/btcmap.png",
		tag: "btcmap",
		sponsor: false,
		stores: [
			{
				store: "f-droid",
				platform: "android",
				url: "https://f-droid.org/en/packages/org.btcmap/",
			},
			{
				store: "apk",
				platform: "android",
				url: "https://github.com/teambtcmap/btcmap-android/releases/latest",
			},
			{
				store: "zapstore",
				platform: "android",
				url: "https://zapstore.dev/apps/org.btcmap",
			},
		],
	},
	{
		id: "btcmap-web",
		name: "BTC Map",
		logo: "/images/apps/btcmap.png",
		tag: "btcmap",
		sponsor: false,
		stores: [
			{
				store: "web",
				platform: "web",
				url: "/map",
			},
		],
	},
	{
		id: "btcmap-ios",
		name: "BTC Map",
		logo: "/images/apps/btcmap.png",
		tag: "btcmap",
		sponsor: false,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/btc-map/id6443604345",
			},
		],
	},

	{
		id: "bitlocal",
		name: "BitLocal",
		logo: "/images/apps/bitlocal.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
			},
		],
	},
	{
		id: "wos",
		name: "Wallet of Satoshi",
		logo: "/images/apps/wos.png",
		tag: "powered-by-btcmap",
		sponsor: true,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/wallet-of-satoshi/id1438599608",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.walletofsatoshi.wallet",
			},
		],
	},
	{
		id: "alby",
		name: "Alby Go",
		logo: "/images/apps/alby.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/app/alby-go-bitcoin-lightning/id6475508537",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.getalby.albygo",
			},
		],
	},
	{
		id: "aqua",
		name: "Aqua",
		logo: "/images/apps/aqua.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/app/aqua-bitcoin-wallet/id1543531557",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=bitcoin.aqua.wallet",
			},
		],
	},
	{
		id: "cash-app",
		name: "Cash App",
		logo: "/images/apps/cash-app.png",
		tag: "powered-by-btcmap",
		sponsor: true,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/cash-app/id711923939",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.square.cash",
			},
		],
	},
	{
		id: "blink",
		name: "Blink",
		logo: "/images/apps/blink.png",
		tag: "coming-soon",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=io.blink.wallet",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/blink-bitcoin-wallet/id1559600189",
			},
		],
	},
	{
		id: "bull-bitcoin",
		name: "Bull Bitcoin Wallet",
		logo: "/images/apps/bull-bitcoin.png",
		tag: "coming-soon",
		sponsor: true,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.bullbitcoin.mobile",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/ca/app/bull-bitcoin-wallet/id6474683604",
			},
		],
	},
];
