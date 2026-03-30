import { describe, expect, it } from 'vitest';
import type { OhlcPhase } from './jdcharts.types.js';
import {
	constructFromObject,
	convertPercent,
	createLinearScale,
	extend,
	formatAxisTickNumber,
	formatExponent,
	formatNumWidth,
	formatTime,
	generateLineAreaPath,
	generateLinePath,
	generateSmoothAreaPath,
	generateSmoothLinePath,
	generateTicksLinear,
	generateTicksNice,
	getMinMax,
	padString,
	updateArrayIndex,
} from './utils.js';

describe('generateLinePath', () => {
	it('builds M for first point and L for rest', () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 5 },
			{ x: 20, y: 0 },
		];
		expect(generateLinePath(pts)).toBe('M0,0 L10,5 L20,0');
	});

	it('single point', () => {
		expect(generateLinePath([{ x: 3, y: 4 }])).toBe('M3,4');
	});
});

describe('generateLineAreaPath', () => {
	it('closes along baseline y0', () => {
		const path = generateLineAreaPath(
			[
				{ x: 0, y: 10 },
				{ x: 5, y: 20 },
			],
			0,
		);
		expect(path).toMatch(/^M0,10/);
		expect(path).toContain('L5,20');
		expect(path).toMatch(/Z$/);
	});
});

describe('generateSmoothLinePath', () => {
	it('delegates to line path when fewer than 3 points', () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		];
		expect(generateSmoothLinePath(pts)).toBe(generateLinePath(pts));
	});

	it('uses cubic segments for 3+ points', () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 20, y: 0 },
		];
		const p = generateSmoothLinePath(pts);
		expect(p.startsWith('M0,0')).toBe(true);
		expect(p).toContain('C');
	});
});

describe('generateSmoothAreaPath', () => {
	it('delegates when fewer than 3 points', () => {
		const pts = [
			{ x: 0, y: 1 },
			{ x: 1, y: 2 },
		];
		expect(generateSmoothAreaPath(pts, 0)).toBe(generateLineAreaPath(pts, 0));
	});

	it('returns closed path for many points', () => {
		const pts = [
			{ x: 0, y: 10 },
			{ x: 5, y: 20 },
			{ x: 10, y: 10 },
		];
		const p = generateSmoothAreaPath(pts, 0);
		expect(p.endsWith('Z')).toBe(true);
		expect(p).toContain('C');
	});
});

describe('createLinearScale', () => {
	it('maps domain to range linearly', () => {
		const s = createLinearScale([0, 100], [0, 500]);
		expect(s(0)).toBe(0);
		expect(s(100)).toBe(500);
		expect(s(50)).toBe(250);
	});

	it('handles inverted range', () => {
		const s = createLinearScale([0, 10], [100, 0]);
		expect(s(0)).toBe(100);
		expect(s(10)).toBe(0);
	});
});

describe('generateTicksLinear', () => {
	it('evenly spaces ticks including endpoints', () => {
		expect(generateTicksLinear(0, 100, 5)).toEqual([0, 25, 50, 75, 100]);
	});
});

describe('generateTicksNice', () => {
	it('returns empty when count is not positive', () => {
		expect(generateTicksNice(0, 100, 0)).toEqual([]);
		expect(generateTicksNice(0, 100, -1)).toEqual([]);
	});

	it('returns single tick when start equals stop', () => {
		expect(generateTicksNice(42, 42, 5)).toEqual([42]);
	});

	it('produces descending ticks when stop < start', () => {
		const ticks = generateTicksNice(100, 0, 5);
		expect(ticks.length).toBeGreaterThan(1);
		for (let i = 1; i < ticks.length; i++) {
			expect(ticks[i]!).toBeLessThan(ticks[i - 1]!);
		}
	});

	it('returns monotonic nice ticks across a span', () => {
		const ticks = generateTicksNice(0, 97.3, 6);
		expect(ticks.length).toBeGreaterThan(1);
		for (let i = 1; i < ticks.length; i++) {
			expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
		}
	});
});

describe('formatAxisTickNumber', () => {
	it('returns empty for non-finite', () => {
		expect(formatAxisTickNumber(Number.NaN)).toBe('');
		expect(formatAxisTickNumber(Number.POSITIVE_INFINITY)).toBe('');
	});

	it('normalizes negative zero', () => {
		expect(formatAxisTickNumber(-0)).toBe('0');
	});

	it('formats zero', () => {
		expect(formatAxisTickNumber(0)).toBe('0');
	});

	it('uses grouping for ordinary numbers', () => {
		expect(formatAxisTickNumber(1234.5)).toMatch(/1/);
		expect(formatAxisTickNumber(1234.5)).toContain('234');
	});
});

describe('formatNumWidth', () => {
	it('round-trips small decimals', () => {
		const n = formatNumWidth(0.001234567);
		expect(Number.isFinite(n)).toBe(true);
	});
});

describe('formatExponent', () => {
	it('handles values with e notation', () => {
		const n = formatExponent(1.23e-7);
		expect(Number.isFinite(n)).toBe(true);
	});
});

describe('formatTime', () => {
	it('short form omits time', () => {
		const d = new Date(Date.UTC(2024, 0, 15, 12, 30));
		expect(formatTime(d, false)).toContain('Jan');
		expect(formatTime(d, false)).toContain('15');
	});

	it('temp form includes hours and minutes', () => {
		const d = new Date(2024, 5, 1, 9, 7);
		const s = formatTime(d, true);
		expect(s).toContain('9:07');
	});
});

describe('convertPercent', () => {
	it('parses percent of wrap', () => {
		expect(convertPercent('50%', 200)).toBe(100);
	});

	it('passes through plain numbers', () => {
		expect(convertPercent(40, 100)).toBe(40);
	});
});

describe('padString', () => {
	it('pads short strings to width', () => {
		expect(padString('hi').length).toBeGreaterThanOrEqual(20);
	});

	it('does not truncate long strings', () => {
		const long = 'x'.repeat(30);
		expect(padString(long).length).toBe(30);
	});
});

describe('constructFromObject', () => {
	it('assigns partial keys onto instance', () => {
		const o = constructFromObject({ a: 1, b: 2 }, { b: 3 });
		expect(o).toEqual({ a: 1, b: 3 });
	});
});

describe('updateArrayIndex', () => {
	it('rewrites index in order', () => {
		const arr = [{ index: 9 }, { index: 9 }];
		updateArrayIndex(arr);
		expect(arr[0]!.index).toBe(0);
		expect(arr[1]!.index).toBe(1);
	});
});

describe('extend', () => {
	it('shallow merges', () => {
		expect(extend({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
	});
});

describe('getMinMax', () => {
	const phases: OhlcPhase[] = [
		{
			startTime: 0,
			endTime: 1,
			open: 10,
			high: 12,
			low: 9,
			close: 11,
			vol: 100,
		},
		{
			startTime: 1,
			endTime: 2,
			open: 11,
			high: 15,
			low: 8,
			close: 10,
			vol: 200,
		},
	];

	it('OHLC mode returns low/high extrema', () => {
		expect(getMinMax(phases, true)).toEqual([8, 15]);
	});

	it('volume mode returns [0, max vol]', () => {
		expect(getMinMax(phases, false)).toEqual([0, 200]);
	});
});
