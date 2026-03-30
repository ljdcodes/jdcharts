import { describe, expect, it } from 'vitest';
import { buildSyntheticOhlcPhases } from './ohlc-fallback.js';

describe('buildSyntheticOhlcPhases', () => {
	it('returns requested bar count', () => {
		const bars = buildSyntheticOhlcPhases(10);
		expect(bars).toHaveLength(10);
	});

	it('is deterministic with fixed seed', () => {
		const a = buildSyntheticOhlcPhases(5, { seed: 99 });
		const b = buildSyntheticOhlcPhases(5, { seed: 99 });
		expect(a.map((p) => p.close)).toEqual(b.map((p) => p.close));
	});

	it('produces ordered time ranges', () => {
		const bars = buildSyntheticOhlcPhases(20, { seed: 1 });
		for (let i = 1; i < bars.length; i++) {
			expect(bars[i]!.startTime).toBeGreaterThanOrEqual(bars[i - 1]!.endTime);
		}
	});

	it('keeps OHLC invariants per bar', () => {
		const bars = buildSyntheticOhlcPhases(30, { seed: 7 });
		for (const p of bars) {
			expect(p.high).toBeGreaterThanOrEqual(p.low);
			expect(p.high).toBeGreaterThanOrEqual(p.open);
			expect(p.high).toBeGreaterThanOrEqual(p.close);
			expect(p.low).toBeLessThanOrEqual(p.open);
			expect(p.low).toBeLessThanOrEqual(p.close);
			expect(p.vol).toBeGreaterThanOrEqual(0);
		}
	});
});
