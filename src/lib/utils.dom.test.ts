import { describe, expect, it, vi } from 'vitest';
import { getDOMPosition, getOffset } from './utils.js';

describe('getOffset / getDOMPosition', () => {
	it('uses bounding rect and scroll', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
			width: 320,
			height: 240,
			top: 10,
			left: 20,
			right: 340,
			bottom: 250,
			x: 20,
			y: 10,
			toJSON: () => ({}),
		} as DOMRect);
		Object.defineProperty(window, 'scrollX', { value: 5, configurable: true });
		Object.defineProperty(window, 'scrollY', { value: 7, configurable: true });

		const off = getOffset(el);
		expect(off.left).toBe(25);
		expect(off.top).toBe(17);

		const pos = getDOMPosition(el);
		expect(pos.width).toBe(320);
		expect(pos.height).toBe(240);
		expect(pos.right).toBe(off.left + 320);
		expect(pos.bottom).toBe(off.top + 240);
	});
});
