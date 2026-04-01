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
				url: "https://apps.apple.com/us/app/btc-map/id6502495265",
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
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
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
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
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
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
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
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
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
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
			},
		],
	},
];
