import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock SvelteKit's browser module
vi.mock('$app/environment', () => ({
	browser: true
}));

import { parseMerchantHash, updateMerchantHash } from './merchantDrawerHash';

describe('parseMerchantHash', () => {
	beforeEach(() => {
		// Mock window.location.hash before each test
		delete (window as unknown as { location: unknown }).location;
		(window as unknown as { location: { hash: string } }).location = { hash: '' };
	});

	describe('parsing merchant without map coordinates', () => {
		it('should parse #merchant=123', () => {
			window.location.hash = '#merchant=123';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 123,
				drawerView: 'details',
				isOpen: true
			});
		});

		it('should parse #merchant=123&view=boost', () => {
			window.location.hash = '#merchant=123&view=boost';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 123,
				drawerView: 'boost',
				isOpen: true
			});
		});
	});

	describe('parsing merchant with map coordinates', () => {
		it('should parse #14/10.24279/-67.58397&merchant=24180', () => {
			window.location.hash = '#14/10.24279/-67.58397&merchant=24180';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 24180,
				drawerView: 'details',
				isOpen: true
			});
		});

		it('should parse #14/10.24279/-67.58397&merchant=24180&view=boost', () => {
			window.location.hash = '#14/10.24279/-67.58397&merchant=24180&view=boost';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 24180,
				drawerView: 'boost',
				isOpen: true
			});
		});
	});

	describe('parsing empty or invalid hashes', () => {
		it('should return null merchantId for empty hash', () => {
			window.location.hash = '';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: 'details',
				isOpen: false
			});
		});

		it('should return null merchantId for hash without merchant param', () => {
			window.location.hash = '#14/10.24279/-67.58397';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: 'details',
				isOpen: false
			});
		});

		it('should return null merchantId for #merchant=invalid', () => {
			window.location.hash = '#merchant=invalid';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: 'details',
				isOpen: false
			});
		});

		it('should return null merchantId for negative values', () => {
			window.location.hash = '#merchant=-5';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: 'details',
				isOpen: false
			});
		});

		it('should return null merchantId for zero', () => {
			window.location.hash = '#merchant=0';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: 'details',
				isOpen: false
			});
		});

		it('should return null merchantId for decimal values', () => {
			window.location.hash = '#merchant=123.45';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: null,
				drawerView: 'details',
				isOpen: false
			});
		});
	});

	describe('parsing with invalid view param', () => {
		it('should default to "details" for invalid view param', () => {
			window.location.hash = '#merchant=123&view=invalid';
			const result = parseMerchantHash();
			expect(result).toEqual({
				merchantId: 123,
				drawerView: 'details',
				isOpen: true
			});
		});
	});
});

describe('updateMerchantHash', () => {
	beforeEach(() => {
		// Mock window.location
		delete (window as unknown as { location: unknown }).location;
		(window as unknown as { location: { hash: string } }).location = { hash: '' };
	});

	describe('setting merchant hash', () => {
		it('should set merchant hash without map coordinates', () => {
			window.location.hash = '';
			updateMerchantHash(123, 'details');
			expect(window.location.hash).toBe('merchant=123');
		});

		it('should set merchant hash with boost view', () => {
			window.location.hash = '';
			updateMerchantHash(123, 'boost');
			expect(window.location.hash).toBe('merchant=123&view=boost');
		});

		it('should preserve map coordinates when setting merchant', () => {
			window.location.hash = '#14/10.24279/-67.58397';
			updateMerchantHash(24180, 'details');
			expect(window.location.hash).toBe('14/10.24279/-67.58397&merchant=24180');
		});

		it('should preserve map coordinates when setting merchant with boost view', () => {
			window.location.hash = '#14/10.24279/-67.58397';
			updateMerchantHash(24180, 'boost');
			expect(window.location.hash).toBe('14/10.24279/-67.58397&merchant=24180&view=boost');
		});

		it('should update existing merchant hash', () => {
			window.location.hash = '#merchant=123';
			updateMerchantHash(456, 'details');
			expect(window.location.hash).toBe('merchant=456');
		});

		it('should update existing merchant hash with map coordinates', () => {
			window.location.hash = '#14/10.24279/-67.58397&merchant=123';
			updateMerchantHash(456, 'boost');
			expect(window.location.hash).toBe('14/10.24279/-67.58397&merchant=456&view=boost');
		});
	});

	describe('removing merchant hash', () => {
		it('should remove merchant hash when passed null', () => {
			window.location.hash = '#merchant=123';
			updateMerchantHash(null, 'details');
			expect(window.location.hash).toBe('');
		});

		it('should preserve map coordinates when removing merchant', () => {
			window.location.hash = '#14/10.24279/-67.58397&merchant=123';
			updateMerchantHash(null, 'details');
			expect(window.location.hash).toBe('14/10.24279/-67.58397');
		});
	});
});
