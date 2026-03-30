// Created by James David

import Chart from './chart.js';
import type { ChartOptions } from './jdcharts.types.js';
import { allCharts } from './registry.js';

export type { ChartContext, ChartData, ChartOptions, OhlcPhase } from './jdcharts.types.js';
export { default as Chart } from './chart.js';
export { seriesTypes } from './series.js';
export { drawCanvasPath } from './render.js';
export * from './utils.js';

export default class JDCharts {
	static allCharts = allCharts;

	constructor() {}

	createChart(options: ChartOptions | undefined): Chart | undefined {
		let chart: Chart | undefined;
		if (options) {
			chart = new Chart(options);
		} else {
			const element = this as unknown as HTMLElement;
			const index = element.getAttribute('data-jdcharts');
			if (index !== null) {
				chart = JDCharts.allCharts[parseInt(index, 10)];
			}
		}
		return chart;
	}

	getChart(index: number): Chart | undefined {
		return JDCharts.allCharts[index];
	}
}

window.addEventListener('resize', () => {
	const prevWindowHeight = window.innerHeight;
	const prevWindowWidth = window.innerWidth;

	setTimeout(() => {
		const windowHeight = window.innerHeight;
		const windowWidth = window.innerWidth;

		if (windowHeight !== prevWindowHeight || windowWidth !== prevWindowWidth) {
			return;
		}

		const charts = JDCharts.allCharts;
		const len = charts.length;

		for (let i = 0; i < len; i++) {
			const chart = charts[i]!;

			const chartNode = chart.node;
			const isVisible = chartNode.offsetParent !== null;

			if (!isVisible) {
				chart.needsResize = true;
			} else {
				chart.redraw();
			}
		}
	}, 300);
});
