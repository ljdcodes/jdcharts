import { describe, expect, it, vi } from 'vitest';
import { drawCanvasPath, svgPathStringToDrawArray } from './render.js';

describe('svgPathStringToDrawArray', () => {
	it('returns empty for blank input', () => {
		expect(svgPathStringToDrawArray('')).toEqual([]);
		expect(svgPathStringToDrawArray('   ')).toEqual([]);
	});

	it('normalizes commands to uppercase and parses numbers with commas', () => {
		expect(svgPathStringToDrawArray('M1,2 L3,4')).toEqual(['M', 1, 2, 'L', 3, 4]);
	});

	it('handles cubic curves', () => {
		const t = svgPathStringToDrawArray('M0 0 C1 1 2 2 3 3');
		expect(t[0]).toBe('M');
		expect(t).toContain('C');
		expect(t.filter((x) => typeof x === 'number').length).toBeGreaterThanOrEqual(6);
	});

	it('closes with Z', () => {
		expect(svgPathStringToDrawArray('M0 0 L1 1 Z')).toEqual(['M', 0, 0, 'L', 1, 1, 'Z']);
	});

	it('drops non-numeric tokens between commands', () => {
		const t = svgPathStringToDrawArray('M0,0 Lx,4');
		expect(t).toEqual(['M', 0, 0, 'L', 4]);
	});
});

describe('drawCanvasPath', () => {
	it('invokes canvas path methods for move/line/close', () => {
		const moveTo = vi.fn();
		const lineTo = vi.fn();
		const closePath = vi.fn();
		const beginPath = vi.fn();
		const ctx = {
			beginPath,
			moveTo,
			lineTo,
			bezierCurveTo: vi.fn(),
			closePath,
			fill: vi.fn(),
			stroke: vi.fn(),
			setLineDash: vi.fn(),
			lineWidth: 0,
			strokeStyle: '',
			fillStyle: '',
		} as unknown as CanvasRenderingContext2D;

		drawCanvasPath(ctx, ['M', 0, 0, 'L', 10, 10, 'Z'], { strokeColor: '#000', fillColor: '#f00' });

		expect(beginPath).toHaveBeenCalled();
		expect(moveTo).toHaveBeenCalledWith(0, 0);
		expect(lineTo).toHaveBeenCalledWith(10, 10);
		expect(closePath).toHaveBeenCalled();
	});

	it('skips segments with wrong arg count', () => {
		const moveTo = vi.fn();
		const ctx = {
			beginPath: vi.fn(),
			moveTo,
			lineTo: vi.fn(),
			closePath: vi.fn(),
			fill: vi.fn(),
			stroke: vi.fn(),
			setLineDash: vi.fn(),
			lineWidth: 0,
			strokeStyle: '',
			fillStyle: '',
		} as unknown as CanvasRenderingContext2D;

		drawCanvasPath(ctx, ['M', 0], { strokeColor: '#000' });
		expect(moveTo).not.toHaveBeenCalled();
	});
});
