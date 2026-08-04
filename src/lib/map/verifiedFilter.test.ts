import { afterEach, describe, expect, it } from "vitest";

import {
	getStoredVerifiedFilter,
	storeVerifiedFilter,
	VERIFIED_FILTER_STORAGE_KEY,
} from "./verifiedFilter";

afterEach(() => {
	localStorage.removeItem(VERIFIED_FILTER_STORAGE_KEY);
});

describe("verified filter persistence", () => {
	it("round-trips the numeric year windows", () => {
		storeVerifiedFilter(2);
		expect(getStoredVerifiedFilter()).toBe(2);
	});

	it("round-trips the outdated mode", () => {
		storeVerifiedFilter("outdated");
		expect(getStoredVerifiedFilter()).toBe("outdated");
	});

	it("clears storage for the Any (null) state", () => {
		storeVerifiedFilter(3);
		storeVerifiedFilter(null);
		expect(localStorage.getItem(VERIFIED_FILTER_STORAGE_KEY)).toBeNull();
		expect(getStoredVerifiedFilter()).toBeNull();
	});

	it("ignores unknown stored values", () => {
		localStorage.setItem(VERIFIED_FILTER_STORAGE_KEY, "7");
		expect(getStoredVerifiedFilter()).toBeNull();
		localStorage.setItem(VERIFIED_FILTER_STORAGE_KEY, "garbage");
		expect(getStoredVerifiedFilter()).toBeNull();
	});
});
