// Demo: Binance REST → ChartData (not in npm package).

import type { ChartContext, ChartData, OhlcPhase } from '../lib/jdcharts.types.js';
import { buildSyntheticOhlcPhases } from './ohlc-fallback.js';

type BinanceKline = [
	number,
	string,
	string,
	string,
	string,
	string,
	number,
	...unknown[],
];

export function mapBarsToInterval(barType: string, barWidth: string): string {
	const bw = barWidth.trim();
	if (bw === '1M') return '1M';
	if (bw === '1m' || bw === '1min') return '1m';

	const w = `${barType}:${barWidth}`.toLowerCase();
	if (w.includes('week') || w.includes('1w')) return '1w';
	if (w.includes('1d') || w.includes('day') || bw.toUpperCase() === '1D') return '1d';
	if (w.includes('4h')) return '4h';
	if (w.includes('1h') || w.includes('60m')) return '1h';
	if (w.includes('15m')) return '15m';
	if (w.includes('5m')) return '5m';
	if (w.includes('30m')) return '30m';
	return '1d';
}

function getSymbol(settings: Partial<ChartContext>): string {
	const s = String(settings.symbol ?? 'BTCUSDT');
	return s.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'BTCUSDT';
}

function getInterval(settings: Partial<ChartContext>): string {
	return mapBarsToInterval(String(settings.barType ?? '1d'), String(settings.barWidth ?? '1d'));
}

export async function fetchBinanceKlines(settings: Partial<ChartContext>): Promise<BinanceKline[]> {
	const symbol = getSymbol(settings);
	const interval = getInterval(settings);
	const limit = 500;

	const url = new URL('https://api.binance.com/api/v3/klines');
	url.searchParams.set('symbol', symbol);
	url.searchParams.set('interval', interval);
	url.searchParams.set('limit', String(limit));

	const response = await fetch(url.toString());
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Binance HTTP ${response.status}: ${text.slice(0, 200)}`);
	}

	return (await response.json()) as BinanceKline[];
}

export function klinesToChartData(klines: BinanceKline[]): ChartData {
	const ohlc: OhlcPhase[] = [];

	for (const k of klines) {
		const startTime = k[0];
		const closeTime = k[6];
		ohlc.push({
			startTime,
			endTime: closeTime,
			open: parseFloat(k[1]),
			high: parseFloat(k[2]),
			low: parseFloat(k[3]),
			close: parseFloat(k[4]),
			vol: parseFloat(k[5]),
		});
	}

	return {
		ohlc,
		volume: ohlc.map((p) => ({ x: p.startTime, y: p.vol })),
	};
}

function syntheticFallback(): ChartData {
	const ohlc = buildSyntheticOhlcPhases(120);
	return {
		ohlc,
		volume: ohlc.map((p) => ({ x: p.startTime, y: p.vol })),
	};
}

/** Live klines or synthetic fallback when venue is `demo` or fetch fails. */
export async function fetchBinanceChartData(settings: Partial<ChartContext>): Promise<ChartData> {
	const venue = String(settings.venueLabel ?? 'binance').toLowerCase();
	if (venue === 'demo') {
		return syntheticFallback();
	}

	try {
		const klines = await fetchBinanceKlines(settings);
		if (!klines.length) {
			throw new Error('No candle data returned from Binance.');
		}
		return klinesToChartData(klines);
	} catch (err) {
		console.warn('Demo: Binance request failed — using synthetic OHLC.', err);
		return syntheticFallback();
	}
}
