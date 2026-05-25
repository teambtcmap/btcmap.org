import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({
	browser: true,
}));

import { parseMerchantHash, updateMerchantHash } from "./merchantDrawerHash";

describe("parseMerchantHash", () => {
	beforeEach(() => {
		delete (window as unknown as { location: unknown }).location;
		(
			window as unknown as { location: { search: string; hash: string } }
		).location = {
			search: "",
			hash: "",
		};
	});

	describe("parsing merchant from query params", () => {
		it("should parse ?merchant=123", () => {
			window.location.search = "?merchant=123";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 123,
				drawerView: "details",
				isOpen: true,
			});
		});

		it("should parse ?merchant=123&view=boost", () => {
			window.location.search = "?merchant=123&view=boost";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 123,
				drawerView: "boost",
				isOpen: true,
			});
		});

		it("should parse ?merchant=123 with map coordinates in hash", () => {
			window.location.hash = "#14/10.24279/-67.58397";
			window.location.search = "?merchant=24180";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 24180,
				drawerView: "details",
				isOpen: true,
			});
		});

		it("should parse ?merchant=123&view=boost with map coordinates in hash", () => {
			window.location.hash = "#14/10.24279/-67.58397";
			window.location.search = "?merchant=24180&view=boost";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 24180,
				drawerView: "boost",
				isOpen: true,
			});
		});
	});

	describe("parsing empty or invalid query params", () => {
		it("should return null merchantId for empty search", () => {
			window.location.search = "";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: "details",
				isOpen: false,
			});
		});

		it("should return null merchantId for search without merchant param", () => {
			window.location.search = "?foo=bar";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: "details",
				isOpen: false,
			});
		});

		it("should return null merchantId for ?merchant=invalid", () => {
			window.location.search = "?merchant=invalid";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: "details",
				isOpen: false,
			});
		});

		it("should return null merchantId for negative values", () => {
			window.location.search = "?merchant=-5";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: "details",
				isOpen: false,
			});
		});

		it("should return null merchantId for zero", () => {
			window.location.search = "?merchant=0";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: "details",
				isOpen: false,
			});
		});

		it("should return null merchantId for decimal values", () => {
			window.location.search = "?merchant=123.45";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: "details",
				isOpen: false,
			});
		});
	});

	describe("parsing with invalid view param", () => {
		it('should default to "details" for invalid view param', () => {
			window.location.search = "?merchant=123&view=invalid";
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 123,
				drawerView: "details",
				isOpen: true,
			});
		});
	});
});

describe("updateMerchantHash", () => {
	beforeEach(() => {
		vi.stubGlobal("history", {
			pushState: vi.fn(),
		});
		delete (window as unknown as { location: unknown }).location;
		(
			window as unknown as {
				location: { search: string; hash: string; href: string };
			}
		).location = {
			search: "",
			hash: "",
			href: "http://localhost/map",
		};
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("setting merchant query params", () => {
		it("should set merchant query params", () => {
			updateMerchantHash(123, "details");
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("merchant=123"),
			);
		});

		it("should set merchant query params with boost view", () => {
			updateMerchantHash(123, "boost");
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("merchant=123"),
			);
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("view=boost"),
			);
		});

		it("should preserve hash when setting merchant", () => {
			window.location.hash = "#14/10.24279/-67.58397";
			updateMerchantHash(24180, "details");
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("#14/10.24279/-67.58397"),
			);
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("merchant=24180"),
			);
		});

		it("should preserve hash when setting merchant with boost view", () => {
			window.location.hash = "#14/10.24279/-67.58397";
			updateMerchantHash(24180, "boost");
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("#14/10.24279/-67.58397"),
			);
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("merchant=24180"),
			);
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("view=boost"),
			);
		});
	});

	describe("removing merchant query params", () => {
		it("should remove merchant query params when passed null", () => {
			window.location.search = "?merchant=123";
			updateMerchantHash(null, "details");
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.not.stringContaining("merchant"),
			);
		});

		it("should preserve hash when removing merchant", () => {
			window.location.hash = "#14/10.24279/-67.58397";
			window.location.search = "?merchant=123";
			updateMerchantHash(null, "details");
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.stringContaining("#14/10.24279/-67.58397"),
			);
			expect(history.pushState).toHaveBeenCalledWith(
				null,
				"",
				expect.not.stringContaining("merchant"),
			);
		});
	});
});
