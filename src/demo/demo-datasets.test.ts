import { describe, expect, it } from 'vitest';
import { DEMO_DATASETS, getDemoDatasetById } from './demo-datasets.js';

describe('DEMO_DATASETS', () => {
	it('has unique ids', () => {
		const ids = DEMO_DATASETS.map((d) => d.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('payloads use venue::symbol::label shape', () => {
		for (const d of DEMO_DATASETS) {
			const parts = d.payload.split('::');
			expect(parts.length).toBeGreaterThanOrEqual(3);
			expect(['binance', 'demo']).toContain(parts[0]);
		}
	});
});

describe('getDemoDatasetById', () => {
	it('returns a row for known id', () => {
		expect(getDemoDatasetById('btc')?.label).toBe('BTC');
		expect(getDemoDatasetById('silver')?.payload.startsWith('demo::')).toBe(true);
	});

	it('returns undefined for unknown id', () => {
		expect(getDemoDatasetById('nope')).toBeUndefined();
	});
});
