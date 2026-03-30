// Created by James David

import type Chart from './chart.js';
import type { SeriesUserOptions } from './jdcharts.types.js';
import { drawCanvasPath, svgPathStringToDrawArray, type CanvasPathStyle } from './render.js';
import {
	generateLinePath,
	generateSmoothAreaPath,
	generateSmoothLinePath,
	Padding,
	Positions,
	updateArrayIndex,
} from './utils.js';

class SeriesTab {
	series: Series;
	index: number;
	seriesTabDOM!: HTMLElement;
	seriesTabCloseDOM!: HTMLElement;
	seriesTabTitleDOM!: HTMLSpanElement;
	seriesTabSettingsDOM!: HTMLElement;

	constructor(series: Series, index: number) {
		this.series = series;
		this.index = index;
		const skipTabChrome = series.isMainSeries && series.seriesType !== 'indicator';
		if (skipTabChrome) {
			this.seriesTabDOM = document.createElement('div');
			this.seriesTabTitleDOM = document.createElement('span');
			this.seriesTabCloseDOM = document.createElement('span');
			this.seriesTabSettingsDOM = document.createElement('span');
			return;
		}
		this.initDOM();
		this.initEventListeners();
	}

	initDOM(): void {
		const seriesTab = this;
		const series = seriesTab.series;
		const chart = series.chart;

		const templateEl = document.getElementById('series_tab_template');
		if (!templateEl) throw new Error('series_tab_template not found');
		const template = templateEl.innerHTML;
		const parsed = new DOMParser().parseFromString(template, 'text/html').body.querySelector('.series-tab');
		if (!parsed) throw new Error('series-tab root not found in template');
		const templateDOM = parsed.cloneNode(true) as HTMLElement;
		seriesTab.seriesTabDOM = templateDOM;
		seriesTab.seriesTabTitleDOM = seriesTab.seriesTabDOM.querySelector('.series-tab-title span') as HTMLSpanElement;
		seriesTab.seriesTabCloseDOM = seriesTab.seriesTabDOM.querySelector('.series-tab-close') as HTMLElement;
		seriesTab.seriesTabSettingsDOM = seriesTab.seriesTabDOM.querySelector('.series-tab-settings') as HTMLElement;

		const seriesTypeTitle = series.seriesType === 'column' ? 'Volume' : series.seriesType;
		seriesTab.seriesTabTitleDOM.textContent = seriesTypeTitle;

		if (series.isMainSeries) {
			seriesTab.seriesTabDOM.classList.add('main-series-tab');
		}

		chart.node.appendChild(seriesTab.seriesTabDOM);
	}

	initEventListeners(): void {
		const seriesTab = this;
		seriesTab.seriesTabSettingsDOM.addEventListener('click', (e) => seriesTab.openSeriesSettings(e));
		seriesTab.seriesTabCloseDOM.addEventListener('click', () => seriesTab.removeSeries());
	}

	openSeriesSettings(_e: MouseEvent): void {}

	removeSeries(): void {
		const seriesTab = this;
		const series = seriesTab.series;
		const chart = series.chart;
		const yAxis = series.yAxis;

		const removeHeight = yAxis.fullHeight;

		chart.series.splice(series.index, 1);
		chart.yAxis.splice(yAxis.index, 1);
		chart.axes = chart.xAxis.concat(chart.yAxis);

		const numYAxis = chart.yAxis.length;
		const heightPortion = removeHeight / numYAxis;

		for (const loopYAxis of chart.yAxis) {
			loopYAxis.fullHeight = loopYAxis.fullHeight + heightPortion;
			loopYAxis.height = loopYAxis.fullHeight - (loopYAxis.padding.top + loopYAxis.padding.bottom);
		}

		seriesTab.seriesTabDOM.remove();

		updateArrayIndex(chart.series);
		updateArrayIndex(chart.yAxis);

		chart.redraw();
	}

	updatePositions(): void {
		const seriesTab = this;
		const series = seriesTab.series;
		if (series.isMainSeries && series.seriesType !== 'indicator') return;

		const yAxis = series.yAxis;
		const newTop = yAxis.pos.top - yAxis.padding.top + 3;

		seriesTab.seriesTabDOM.style.left = '0';
		seriesTab.seriesTabDOM.style.top = `${newTop}px`;
	}
}

export default class Series {
	chart!: Chart;
	seriesType = '';
	index = 0;
	isMainSeries = false;
	usesMainData = false;

	yAxis!: import('./axis.js').default;
	xAxis!: import('./axis.js').default;

	isResizingSeries = false;
	height = 0;
	width = 0;

	positions = new Positions();
	padding = new Padding();

	seriesTab!: SeriesTab;

	/** Y-range for indicator panes (non-OHLC series). Main/volume axes use OHLC-derived ranges. */
	formattedData: { min: number; max: number } = { min: 0, max: 1 };

	constructor() {}

	init(chart: Chart, userOptions: SeriesUserOptions): void {
		const series = this;
		series.chart = chart;

		series.seriesType = userOptions.seriesType;
		series.index = userOptions.index;
		series.isMainSeries = series.index === 0;
		series.usesMainData = series.seriesType === 'column';

		series.yAxis = chart.yAxis[series.index]!;
		series.xAxis = chart.xAxis[0]!;
		series.yAxis.series = series;
		series.xAxis.series = series;

		series.padding = { ...series.padding, ...userOptions.padding };

		series.seriesTab = new SeriesTab(series, series.index);
		series.seriesTab.updatePositions();

		if (series.seriesType === 'indicator') {
			const indSettings = userOptions.indicatorSettings ?? {};
			series.seriesTab.seriesTabTitleDOM.textContent = indSettings.icode ?? 'indicator';
		}
	}

	drawPoints(): void {}

	async getSeriesData(): Promise<void> {}
}

class Candlestick extends Series {
	closedHigherFill = 'transparent';
	closedHigherStroke = '#19B34C';
	closedLowerFill = '#990F0F';
	closedLowerStroke = '#D12E2E';

	override init(chart: Chart, userOptions: SeriesUserOptions): void {
		super.init(chart, userOptions);
		this.seriesType = 'candlestick';
	}

	override drawPoints(): void {
		const series = this;
		const chart = series.chart;
		const xAxis = series.xAxis;
		const ctx = chart.ctx!;
		const allPoints = chart.allPoints;
		const pointWidth = xAxis.pointWidth;

		for (const point of allPoints) {
			const phase = point.phase;
			const pos = point.pos;

			const closedHigher = phase.close > phase.open;

			const strokeColor = closedHigher ? series.closedHigherStroke : series.closedLowerStroke;
			let fillColor = closedHigher ? series.closedHigherFill : series.closedLowerFill;

			let topBody = pos.topBody;
			let bottomBody = pos.bottomBody;

			if (pointWidth <= 2 && closedHigher) {
				fillColor = 'transparent';
			}
			if (bottomBody - topBody < 1) {
				bottomBody += 0.5;
				topBody -= 0.5;
			}

			const leftPos = pos.left;
			const rightPos = pos.right;

			const d: (string | number)[] = [
				'M',
				leftPos,
				topBody,
				'L',
				leftPos,
				bottomBody,
				'L',
				rightPos,
				bottomBody,
				'L',
				rightPos,
				topBody,
				'Z',
				'M',
				pos.middle,
				bottomBody,
				'L',
				pos.middle,
				pos.bottomLeg,
				'M',
				pos.middle,
				topBody,
				'L',
				pos.middle,
				pos.topLeg,
			];

			const pathStyle: CanvasPathStyle = {
				strokeColor,
				fillColor,
			};

			drawCanvasPath(ctx, d, pathStyle);
		}
	}
}

class OHLC extends Series {
	override init(chart: Chart, userOptions: SeriesUserOptions): void {
		super.init(chart, userOptions);
		this.seriesType = 'ohlc';
	}

	override drawPoints(): void {
		const series = this;
		const chart = series.chart;
		const xAxis = series.xAxis;
		const allPoints = chart.allPoints;
		const pointWidth = xAxis.pointWidth;
		const ctx = chart.ctx!;

		for (const point of allPoints) {
			const phase = point.phase;
			const pos = point.pos;
			const closedHigher = phase.close > phase.open;
			let topBody = pos.topBody;
			let bottomBody = pos.bottomBody;

			if (pointWidth <= 2) {
				topBody = pos.topLeg;
				bottomBody = pos.bottomLeg;
			}

			const openPos = closedHigher ? pos.bottomBody : pos.topBody;
			const closePos = closedHigher ? pos.topBody : pos.bottomBody;
			const leftPos = pos.left - 0.5 - xAxis.pointPadding / 2;
			const rightPos = pos.right + 0.5 + xAxis.pointPadding / 2;

			const strokeColor = '#66CCCC';
			const fillColor = 'transparent';

			const d: (string | number)[] = [
				'M',
				leftPos,
				openPos,
				'L',
				pos.middle,
				openPos,
				'M',
				pos.middle,
				pos.bottomLeg,
				'L',
				pos.middle,
				openPos,
				'M',
				pos.middle,
				pos.topLeg,
				'L',
				pos.middle,
				openPos,
				'M',
				rightPos,
				closePos,
				'L',
				pos.middle,
				closePos,
			];

			const pathStyle: CanvasPathStyle = {
				strokeColor,
				fillColor,
			};

			drawCanvasPath(ctx, d, pathStyle);
		}
	}
}

class Column extends Series {
	closedHigherFill = 'transparent';
	closedHigherStroke = '#19B34C';
	closedLowerFill = '#990F0F';
	closedLowerStroke = '#D12E2E';

	override init(chart: Chart, userOptions: SeriesUserOptions): void {
		super.init(chart, userOptions);
		this.seriesType = 'column';
	}

	override drawPoints(): void {
		const series = this;
		const chart = series.chart;
		const xAxis = series.xAxis;
		const yAxis = series.yAxis;

		const allPoints = chart.allPoints;
		const ctx = chart.ctx!;

		for (const point of allPoints) {
			const phase = point.phase;
			const pos = point.pos;

			const volTop = Math.floor(yAxis.getPositionFromValue(phase.vol)) + 0.5;
			const volHeight = yAxis.pos.bottom - volTop;

			void volHeight;

			const closedHigher = phase.close > phase.open;

			const strokeColor = closedHigher ? series.closedHigherStroke : series.closedLowerStroke;
			const fillColor = closedHigher ? series.closedHigherFill : series.closedLowerFill;

			const d: (string | number)[] = [
				'M',
				pos.left,
				volTop,
				'L',
				pos.left,
				yAxis.pos.bottom,
				'L',
				pos.right,
				yAxis.pos.bottom,
				'L',
				pos.right,
				volTop,
				'Z',
			];

			const pathStyle: CanvasPathStyle = {
				strokeColor,
				fillColor,
			};

			drawCanvasPath(ctx, d, pathStyle);
		}
	}
}

class Line extends Series {
	lineColor = '#D4F6FF';

	override init(chart: Chart, userOptions: SeriesUserOptions): void {
		super.init(chart, userOptions);
		this.seriesType = 'line';
	}

	override drawPoints(): void {
		const series = this;
		const chart = series.chart;
		const xAxis = series.xAxis;
		const yAxis = series.yAxis;

		const allPoints = chart.allPoints;
		const ctx = chart.ctx!;

		const positions: { x: number; y: number }[] = [];

		for (const point of allPoints) {
			const phase = point.phase;
			const pos = point.pos;
			const price = phase.close;
			const pixel = Math.floor(yAxis.getPositionFromValue(price));
			positions.push({ x: pos.middle, y: pixel });
		}

		if (positions.length === 0) return;

		const rawPath = generateSmoothLinePath(positions);
		const arr = svgPathStringToDrawArray(rawPath);
		if (arr.length === 0) return;

		const pathStyle: CanvasPathStyle = {
			strokeColor: series.lineColor,
			fillColor: 'transparent',
			lineWidth: 1.5,
		};

		drawCanvasPath(ctx, arr, pathStyle);
	}
}

class Area extends Series {
	fillColor = '#425A70';
	lineColor = '#6797c5';

	override init(chart: Chart, userOptions: SeriesUserOptions): void {
		super.init(chart, userOptions);
		this.seriesType = 'area';
	}

	override drawPoints(): void {
		const series = this;
		const chart = series.chart;
		const yAxis = series.yAxis;
		const ctx = chart.ctx!;

		const allPoints = chart.allPoints;

		const positions: { x: number; y: number }[] = [];

		for (const point of allPoints) {
			const phase = point.phase;
			const pos = point.pos;

			const price = phase.close;
			const pixel = Math.floor(yAxis.getPositionFromValue(price));
			positions.push({ x: pos.middle, y: pixel });
		}

		if (positions.length === 0) return;

		const rawAreaPath = generateSmoothAreaPath(positions, yAxis.pos.bottom);
		const areaArr = svgPathStringToDrawArray(rawAreaPath);
		if (areaArr.length === 0) return;

		const areaPathStyle: CanvasPathStyle = {
			strokeColor: 'transparent',
			fillColor: series.fillColor,
			lineWidth: 0,
		};

		const rawLinePath = generateLinePath(positions);
		const lineArr = svgPathStringToDrawArray(rawLinePath);
		if (lineArr.length === 0) return;

		const linePathStyle: CanvasPathStyle = {
			strokeColor: series.lineColor,
			fillColor: 'transparent',
			lineWidth: 1.5,
		};

		drawCanvasPath(ctx, areaArr, areaPathStyle);
		drawCanvasPath(ctx, lineArr, linePathStyle);
	}
}

export const seriesTypes: Record<string, new () => Series> = {
	indicator: Candlestick,
	candlestick: Candlestick,
	ohlc: OHLC,
	line: Line,
	area: Area,
	column: Column,
};
