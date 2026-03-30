// Demo: synthetic OHLC when fetch fails or CORS blocks Binance.

import type { OhlcPhase } from '../lib/jdcharts.types.js';

export type SyntheticOhlcOptions = {
	seed?: number;
	basePrice?: number;
	volBase?: number;
	volSpread?: number;
	driftScale?: number;
};

export function buildSyntheticOhlcPhases(barCount = 90, opts?: SyntheticOhlcOptions): OhlcPhase[] {
	const day = 86400000;
	const now = Date.now();
	let seed = opts?.seed ?? 42;
	const rnd = (): number => {
		seed = (seed * 1103515245 + 12345) >>> 0;
		return seed / 4294967296;
	};

	const driftScale = opts?.driftScale ?? 0.04;
	const volBase = opts?.volBase ?? 800;
	const volSpread = opts?.volSpread ?? 1200;

	let price = (opts?.basePrice ?? 42000) + rnd() * (opts?.basePrice ? opts.basePrice * 0.02 : 2000);
	const out: OhlcPhase[] = [];

	for (let i = 0; i < barCount; i++) {
		const startTime = now - (barCount - i) * day;
		const endTime = startTime + day - 1;
		const o = price;
		const drift = (rnd() - 0.48) * driftScale;
		price = o * (1 + drift);
		const h = Math.max(o, price) * (1 + rnd() * 0.008);
		const l = Math.min(o, price) * (1 - rnd() * 0.008);
		const c = price;
		const vol = volBase + rnd() * volSpread;
		out.push({ startTime, endTime, open: o, high: h, low: l, close: c, vol });
	}

	return out;
}
