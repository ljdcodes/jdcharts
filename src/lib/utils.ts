// Created by James David

import type { OhlcPhase } from './jdcharts.types.js';

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

export function generateSmoothAreaPath(
	points: { x: number; y: number }[],
	y0: number,
): string {
	if (points.length < 3) return generateLineAreaPath(points, y0);

	let upperPath = '';
	let lowerPath = '';

	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1]!;
		const curr = points[i]!;
		const next = points[i + 1];

		const ctrl1 = {
			x: (curr.x + prev.x) / 2,
			y: (curr.y + prev.y) / 2,
		};
		const ctrl2 = next
			? {
					x: (curr.x + next.x) / 2,
					y: (curr.y + next.y) / 2,
				}
			: null;

		upperPath += `C${ctrl1.x},${ctrl1.y},${ctrl2 ? ctrl2.x : curr.x},${ctrl2 ? ctrl2.y : curr.y},${curr.x},${curr.y}`;
		lowerPath = `L${curr.x},${y0}` + lowerPath;
	}

	return `M${points[0]!.x},${points[0]!.y}` + upperPath + lowerPath + 'Z';
}

export function generateLineAreaPath(points: { x: number; y: number }[], y0: number): string {
	let path = `M${points[0]!.x},${points[0]!.y}`;
	for (let i = 1; i < points.length; i++) {
		const curr = points[i]!;
		path += `L${curr.x},${curr.y}`;
	}
	for (let i = points.length - 1; i >= 0; i--) {
		const curr = points[i]!;
		path += `L${curr.x},${y0}`;
	}
	path += 'Z';
	return path;
}

export function generateSmoothLinePath(points: { x: number; y: number }[]): string {
	if (points.length < 3) return generateLinePath(points);

	let path = `M${points[0]!.x},${points[0]!.y}`;

	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1]!;
		const curr = points[i]!;
		const next = points[i + 1]!;

		const ctrl1 = {
			x: (curr.x + prev.x) / 2,
			y: (curr.y + prev.y) / 2,
		};
		const ctrl2 = {
			x: (curr.x + next.x) / 2,
			y: (curr.y + next.y) / 2,
		};

		path += `C${ctrl1.x},${ctrl1.y},${ctrl2.x},${ctrl2.y},${next.x},${next.y}`;
	}

	return path;
}

export function generateLinePath(points: { x: number; y: number }[]): string {
	return points
		.map((d, i) => {
			const command = i === 0 ? 'M' : 'L';
			return `${command}${d.x},${d.y}`;
		})
		.join(' ');
}

export function createLinearScale(domain: [number, number], range: [number, number]): (value: number) => number {
	const domainDelta = domain[1]! - domain[0]!;
	const rangeDelta = range[1]! - range[0]!;

	return function (value: number) {
		return ((value - domain[0]!) / domainDelta) * rangeDelta + range[0]!;
	};
}

export function generateTicksLinear(min: number, max: number, numTicks: number): number[] {
	const interval = (max - min) / (numTicks - 1);
	return Array.from({ length: numTicks }, (_, i) => min + i * interval);
}

/** sqrt constants from d3-array ticks — pick 1/2/5/10 × 10^n steps for human-readable axes */
const TICK_E10 = Math.sqrt(50);
const TICK_E5 = Math.sqrt(10);
const TICK_E2 = Math.sqrt(2);

function tickSpec(
	start: number,
	stop: number,
	count: number,
): [i1: number, i2: number, inc: number] {
	const step = (stop - start) / Math.max(0, count);
	const power = Math.floor(Math.log10(step));
	const error = step / Math.pow(10, power);
	const factor = error >= TICK_E10 ? 10 : error >= TICK_E5 ? 5 : error >= TICK_E2 ? 2 : 1;
	let i1: number;
	let i2: number;
	let inc: number;

	if (power < 0) {
		inc = Math.pow(10, -power) / factor;
		i1 = Math.round(start * inc);
		i2 = Math.round(stop * inc);
		if (i1 / inc < start) ++i1;
		if (i2 / inc > stop) --i2;
		inc = -inc;
	} else {
		inc = Math.pow(10, power) * factor;
		i1 = Math.round(start / inc);
		i2 = Math.round(stop / inc);
		if (i1 * inc < start) ++i1;
		if (i2 * inc > stop) --i2;
	}

	if (i2 < i1 && 0.5 <= count && count < 2) {
		return tickSpec(start, stop, count * 2);
	}
	return [i1, i2, inc];
}

/**
 * “Nice” tick positions (multiples of 1/2/5/10 × 10^n), similar to d3-scaleLinear.ticks().
 * Use for y-axis labels instead of uniform linear spacing.
 */
export function generateTicksNice(start: number, stop: number, count: number): number[] {
	stop = +stop;
	start = +start;
	count = +count;

	if (!(count > 0)) return [];
	if (start === stop) return [start];

	const reverse = stop < start;
	const [a, b] = reverse ? [stop, start] : [start, stop];
	const [i1, i2, inc] = tickSpec(a, b, count);
	if (!(i2 >= i1)) return [];

	const n = i2 - i1 + 1;
	const out: number[] = new Array(n);

	if (reverse) {
		if (inc < 0) {
			for (let i = 0; i < n; ++i) out[i] = (i2 - i) / -inc;
		} else {
			for (let i = 0; i < n; ++i) out[i] = (i2 - i) * inc;
		}
	} else {
		if (inc < 0) {
			for (let i = 0; i < n; ++i) out[i] = (i1 + i) / -inc;
		} else {
			for (let i = 0; i < n; ++i) out[i] = (i1 + i) * inc;
		}
	}

	return out;
}

/** Display string for a y-axis tick: grouping, trimmed trailing zeros, compact extremes */
export function formatAxisTickNumber(n: number): string {
	if (!Number.isFinite(n)) return '';
	if (Object.is(n, -0)) return '0';

	const v = Number.parseFloat(n.toPrecision(12));
	const av = Math.abs(v);
	if (v === 0) return '0';
	if (av >= 1e9 || (av < 1e-6 && av > 0)) {
		return v.toExponential(2);
	}

	return v.toLocaleString('en-US', {
		useGrouping: true,
		maximumFractionDigits: 8,
		minimumFractionDigits: 0,
	});
}

export function getOffset(el: HTMLElement): { top: number; left: number } {
	const rect = el.getBoundingClientRect();
	return {
		top: rect.top + window.scrollY,
		left: rect.left + window.scrollX,
	};
}

export function convertPercent(hw: string | number, wrapHW: number): number {
	const strVal = String(hw);
	const hasPct = strVal.indexOf('%') >= 0;
	let converted: number = typeof hw === 'number' ? hw : parseFloat(strVal) || 0;

	if (hasPct) {
		const valNum = parseFloat(strVal) / 100;
		converted = valNum * Number(wrapHW);
	}

	return converted;
}

export function formatTime(d: Date, temp?: boolean): string {
	const monthNames = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'June',
		'July',
		'Aug',
		'Sept',
		'Oct',
		'Nov',
		'Dec',
	];

	const month = monthNames[d.getMonth()];
	const day = d.getDate();
	const hours = String(d.getHours());
	const minutes = d.getMinutes();
	const minStr = minutes < 10 ? '0' + String(minutes) : String(minutes);

	if (!temp) return month + '. ' + day;
	return month + '. ' + day + ' ' + hours + ':' + minStr;
}

export function formatExponent(num: number): number {
	const maxDec = 8;
	const sind = String(num).search('e');

	let n: number | string = num;

	if (sind !== -1) {
		const partwhole = String(num).slice(0, sind);
		const partall = partwhole.split('.');
		if (partall.length === 1) {
			partall.push('0');
		}
		const exnum = String(num).slice(sind + 1);
		const pow = exnum.slice(1);
		n = Number('0.' + Array(Number(pow) - 0).join('0') + partall[0] + partall[1]);
	}

	const all = String(n).split('.');
	let startDec = 0;

	if (all.length === 2 && Number(all[0]) <= 0) {
		const dec = all[1]!;
		for (let j = 0; j < dec.length; j++) {
			if (Number(dec[j]) > 0) break;
			startDec++;
		}
	} else if (all.length === 1) {
		all.push('0');
	}

	const paddedDec = 3;
	let endDec = startDec + paddedDec;
	if (endDec > maxDec) {
		endDec = maxDec;
	}

	const strDec = Number('0.' + (all[1] ?? '0')).toFixed(endDec);
	const strAll = (all[0] ?? '0') + '.' + strDec.split('.')[1];

	return Number(strAll);
}

export function formatNumWidth(num: number): number {
	const maxDec = 8;
	const all = String(num).split('.');
	let startDec = 0;

	if (all.length === 2 && Number(all[0]) <= 0) {
		const dec = all[1]!;
		for (let j = 0; j < dec.length; j++) {
			if (Number(dec[j]) > 0) break;
			startDec++;
		}
	} else if (all.length === 1) {
		all.push('0');
	}

	const paddedDec = 3;
	let endDec = startDec + paddedDec;

	if (endDec > maxDec) {
		endDec = maxDec;
	}

	const strDec = Number('0.' + (all[1] ?? '0')).toFixed(endDec);
	const strAll = (all[0] ?? '0') + '.' + strDec.split('.')[1];

	return Number(strAll);
}

export function getDOMPosition(el: HTMLElement) {
	const offset = getOffset(el);
	const bbox = el.getBoundingClientRect();

	const width = bbox.width;
	const height = bbox.height;
	return {
		height,
		width,
		top: offset.top,
		bottom: offset.top + height,
		left: offset.left,
		right: offset.left + width,
	};
}

export function padString(str: string): string {
	const numSpaces = 20;
	let needed = numSpaces - str.length;

	if (needed < 0) {
		needed = 0;
	}

	let out = str;
	for (let i = 0; i < needed; i++) {
		out += ' ';
	}

	return out;
}

export function getTextPixelWidth(text: string, fontSize: string): number {
	measureCtx.font = fontSize + ' Roboto';
	return measureCtx.measureText(text).width;
}

export function getMaxTextWidth(vals: number[], fontSize: string, ctx: CanvasRenderingContext2D): number {
	let max = 0;

	ctx.font = fontSize + ' Roboto';
	for (let i = 0; i < vals.length; i++) {
		const text = formatAxisTickNumber(vals[i]!);
		const wid = ctx.measureText(text).width;

		if (wid > max) {
			max = wid;
		}
	}

	return max;
}

export function constructFromObject<T extends object>(classInstance: T, obj: Partial<T> | undefined): T {
	if (obj) {
		for (const key of Object.keys(obj) as (keyof T)[]) {
			(classInstance as Record<string, unknown>)[key as string] = obj[key] as unknown;
		}
	}
	return classInstance;
}

export function updateArrayIndex<T extends { index: number }>(arr: T[]): void {
	for (let i = 0; i < arr.length; i++) {
		arr[i]!.index = i;
	}
}

export function extend<T extends Record<string, unknown>>(base: T, extra: Partial<T>): T {
	return { ...base, ...extra };
}

export function getMinMax(phases: OhlcPhase[], type: boolean): [number, number] {
	let min = 0;
	let max = 0;

	for (let i = 0; i < phases.length; ++i) {
		const phase = phases[i]!;

		if (i === 0) {
			if (type) {
				min = phase.low;
				max = phase.high;
			} else {
				max = phase.vol;
			}
		} else {
			if (type) {
				min = phase.low < min ? phase.low : min;
				max = phase.high > max ? phase.high : max;
			} else {
				max = phases[i]!.vol > max ? phases[i]!.vol : max;
			}
		}
	}

	return [min, max];
}

export class Padding {
	top = 0;
	bottom = 0;
	left = 0;
	right = 0;
}

export class Positions {
	top = 0;
	bottom = 0;
	left = 0;
	right = 0;
}
