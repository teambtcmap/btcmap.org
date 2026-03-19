import { describe, expect, it } from "vitest";

import { getCountryName } from "./countryNames";

describe("getCountryName", () => {
	describe("locale mapping", () => {
		it("returns fallback for English locale (no ISO lookup)", async () => {
			expect(await getCountryName("ZA", "en", "South Africa")).toBe(
				"South Africa",
			);
			expect(await getCountryName("US", "en", "United States")).toBe(
				"United States",
			);
		});

		it("maps pt-BR to pt and returns translated name", async () => {
			const result = await getCountryName("ZA", "pt-BR", "South Africa");
			expect(result).toBe("África do Sul");
		});

		it("maps bg and returns translated name", async () => {
			const result = await getCountryName("ZA", "bg", "South Africa");
			expect(result).toBe("Южна Африка");
		});

		it("falls back to en for unknown locale", async () => {
			expect(await getCountryName("ZA", "invalid-locale", "South Africa")).toBe(
				"South Africa",
			);
		});
	});

	describe("fallback behavior", () => {
		it("returns fallback for unknown country code", async () => {
			expect(await getCountryName("XX", "pt-BR", "Unknown")).toBe("Unknown");
		});

		it("returns fallback when translation unavailable", async () => {
			expect(await getCountryName("ZZ", "bg", "Fallback")).toBe("Fallback");
		});

		it("returns fallback on error (e.g. invalid code)", async () => {
			expect(await getCountryName("", "pt-BR", "Default")).toBe("Default");
		});
	});

	describe("locale registration", () => {
		it("returns same result on repeated calls (locales cached)", async () => {
			const first = await getCountryName("BR", "pt-BR", "Brazil");
			const second = await getCountryName("BR", "pt-BR", "Brazil");
			expect(first).toBe(second);
			expect(first).toBe("Brasil");
		});
	});
});
