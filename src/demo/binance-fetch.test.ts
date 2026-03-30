import { describe, expect, it } from 'vitest';
import { mapBarsToInterval } from './binance-fetch.js';

describe('mapBarsToInterval', () => {
	it('maps monthly shorthand', () => {
		expect(mapBarsToInterval('1d', '1M')).toBe('1M');
	});

	it('maps 1m / 1min', () => {
		expect(mapBarsToInterval('x', '1m')).toBe('1m');
		expect(mapBarsToInterval('x', '1min')).toBe('1m');
	});

	it('detects week from barType string', () => {
		expect(mapBarsToInterval('1w', '1d')).toBe('1w');
		expect(mapBarsToInterval('week', '1d')).toBe('1w');
	});

	it('detects day', () => {
		expect(mapBarsToInterval('1d', '1d')).toBe('1d');
		expect(mapBarsToInterval('day', '1d')).toBe('1d');
		expect(mapBarsToInterval('x', '1D')).toBe('1d');
	});

	it('detects hours (barWidth must not contain a 1d substring or 1d wins first)', () => {
		expect(mapBarsToInterval('4h', '')).toBe('4h');
		expect(mapBarsToInterval('1h', '')).toBe('1h');
		expect(mapBarsToInterval('60m', '')).toBe('1h');
	});

	it('detects minutes', () => {
		expect(mapBarsToInterval('15m', '')).toBe('15m');
		expect(mapBarsToInterval('5m', '')).toBe('5m');
		expect(mapBarsToInterval('30m', '')).toBe('30m');
	});

	it('defaults to 1d', () => {
		expect(mapBarsToInterval('unknown', 'unknown')).toBe('1d');
	});
});
