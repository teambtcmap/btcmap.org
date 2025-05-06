import type { Area } from '$lib/types';

class ServerCache {
	private static instance: ServerCache;
	private areasCache: Area[] = [];
	private lastSync: Date | null = null;

	private constructor() {}

	public static getInstance(): ServerCache {
		if (!ServerCache.instance) {
			ServerCache.instance = new ServerCache();
		}
		return ServerCache.instance;
	}

	public getAreas(): Area[] {
		return this.areasCache;
	}

	public setAreas(areas: Area[]): void {
		this.areasCache = areas;
		this.lastSync = new Date();
	}

	public getLastSync(): Date | null {
		return this.lastSync;
	}
}

export const serverCache = ServerCache.getInstance();
