// Demo page: Binance → ChartData → setData. Not shipped on npm.
// Serve over HTTP (ES modules); `npm run build` then `npm run preview`.

import JDCharts from '../lib/jdcharts.js';
import type Chart from '../lib/chart.js';
import type { ChartOptions } from '../lib/jdcharts.types.js';
import { fetchBinanceChartData } from './binance-fetch.js';
import { DEMO_DATASETS } from './demo-datasets.js';

const wrap = document.querySelector('.chart-wrap');
if (!wrap) {
	throw new Error('.chart-wrap not found');
}

const options: ChartOptions = {
	chart: {
		node: wrap as HTMLElement,
		padding: { top: 0, bottom: 0, left: 0, right: 0 },
	},
	chartContext: {
		venueLabel: 'binance',
		symbol: 'BTCUSDT',
		barType: '1d',
		barWidth: '1D',
		instrumentLabel: 'BTC / USDT',
	},
	xAxis: [
		{
			heightInit: 28,
			widthInit: '100%',
			range: 40,
			minRange: 40,
			numTicks: 8,
			tickLength: 4,
			tickStep: 6,
			labels: { fontSize: '12px', fontColor: '#8C8C8C' },
		},
	],
	yAxis: [
		{
			heightInit: '70%',
			widthInit: '12%',
			minPadding: 0.05,
			maxPadding: 0.05,
			numTicks: 8,
			tickLength: 7,
			labels: { fontSize: '13px', fontColor: '#8C8C8C', textPadding: 5 },
		},
		{
			heightInit: '22%',
			widthInit: '12%',
			minPadding: 0,
			maxPadding: 0.05,
			numTicks: 3,
			tickLength: 7,
			labels: { fontSize: '11px', fontColor: '#8C8C8C', textPadding: 5 },
		},
	],
	series: [
		{ seriesType: 'candlestick', index: 0 },
		{ seriesType: 'column', index: 1 },
	],
};

async function loadChartData(chart: Chart): Promise<void> {
	const settings = chart.userOptions.chartContext ?? {};
	const data = await fetchBinanceChartData(settings);
	chart.setData(data);
	await chart.updateChart();
}

function initDatasetList(chart: Chart): void {
	const datasetList = document.getElementById('jd-dataset-list');
	if (!datasetList) return;

	for (const ds of DEMO_DATASETS) {
		const li = document.createElement('li');
		li.dataset.payload = ds.payload;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'demo-dataset-btn';
		btn.textContent = ds.label;
		btn.title = `Load ${ds.label}`;
		li.appendChild(btn);
		if (ds.id === 'btc') li.classList.add('is-active');
		datasetList.appendChild(li);
	}

	datasetList.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('button.demo-dataset-btn');
		if (!btn) return;
		const li = btn.closest('li');
		const payload = li?.dataset.payload;
		if (!payload) return;
		chart.applyConfigChange({ configType: 'dataset', configVal: payload });
		datasetList.querySelectorAll('li').forEach((l) => l.classList.remove('is-active'));
		li.classList.add('is-active');
		void loadChartData(chart);
	});
}

function initChartHeaderMenus(chart: Chart): void {
	const timeWrap = document.querySelector('.chart-time-wrap');
	const timeTrigger = document.getElementById('jd-time-trigger');
	const timeDropdown = document.getElementById('jd-time-dropdown');
	const timeLabel = document.getElementById('jd-time-label');
	const configWrap = document.querySelector('.chart-config-wrap');
	const configTrigger = document.getElementById('jd-chart-config-trigger');
	const configDropdown = document.getElementById('jd-chart-config-dropdown');
	const chartTypeLabel = document.getElementById('jd-chart-type-label');

	const setTimeOpen = (open: boolean) => {
		timeDropdown?.classList.toggle('active', open);
		timeDropdown?.querySelector('ul')?.classList.toggle('active', open);
		timeTrigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
		timeDropdown?.setAttribute('aria-hidden', open ? 'false' : 'true');
	};

	const setConfigOpen = (open: boolean) => {
		configDropdown?.classList.toggle('active', open);
		configTrigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
		configDropdown?.setAttribute('aria-hidden', open ? 'false' : 'true');
	};

	const closeAll = () => {
		setTimeOpen(false);
		setConfigOpen(false);
	};

	timeTrigger?.addEventListener('click', (e) => {
		e.stopPropagation();
		const willOpen = !timeDropdown?.classList.contains('active');
		setConfigOpen(false);
		setTimeOpen(willOpen);
	});

	configTrigger?.addEventListener('click', (e) => {
		e.stopPropagation();
		const willOpen = !configDropdown?.classList.contains('active');
		setTimeOpen(false);
		setConfigOpen(willOpen);
	});

	timeDropdown?.querySelectorAll('li[data-bar-type]').forEach((el) => {
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			const barType = el.getAttribute('data-bar-type') ?? '';
			const barWidth = el.getAttribute('data-bar-width') ?? '';
			const text = el.textContent?.trim() ?? '';
			chart.applyConfigChange({
				configType: 'time',
				configVal: barType,
				val: barWidth,
			});
			if (timeLabel) timeLabel.textContent = text;
			timeDropdown.querySelectorAll('li').forEach((l) => l.classList.remove('active'));
			el.classList.add('active');
			closeAll();
			void loadChartData(chart);
		});
	});

	configDropdown?.querySelectorAll('.mm-chart-config[data-mm="charttype"] li[data-val]').forEach((el) => {
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			const val = el.getAttribute('data-val') ?? '';
			chart.applyConfigChange({ configType: 'charttype', configVal: val });
			if (chartTypeLabel) chartTypeLabel.textContent = el.textContent?.trim() ?? val;
			el.parentElement?.querySelectorAll('li').forEach((l) => l.classList.remove('active'));
			el.classList.add('active');
			closeAll();
		});
	});

	configDropdown?.querySelectorAll('.mm-chart-config[data-mm="depth"] li[data-val]').forEach((el) => {
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			const val = el.getAttribute('data-val') ?? '';
			const n = Number(val);
			if (!Number.isFinite(n)) return;
			chart.applyConfigChange({ configType: 'depth', configVal: n });
			el.parentElement?.querySelectorAll('li').forEach((l) => l.classList.remove('active'));
			el.classList.add('active');
			closeAll();
		});
	});

	document.addEventListener(
		'click',
		(e) => {
			const t = e.target;
			if (!(t instanceof Node)) return;
			if (timeWrap?.contains(t) || configWrap?.contains(t)) return;
			closeAll();
		},
		true,
	);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeAll();
	});
}

const jd = new JDCharts();
const chart = jd.createChart(options) as Chart | null;
if (chart) {
	initDatasetList(chart);
	initChartHeaderMenus(chart);
	void loadChartData(chart);
}
