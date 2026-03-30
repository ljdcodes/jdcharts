// Created by James David

import Axis from './axis.js';
import type { ChartContext, ChartData, ChartPoint, ChartUserOptions, ConfigChange } from './jdcharts.types.js';
import DomEventHandler from './eventHandler.js';
import PlotHandler from './points.js';
import { drawCanvasPath, type CanvasPathStyle } from './render.js';
import { allCharts } from './registry.js';
import Series, { seriesTypes } from './series.js';
import {
	formatNumWidth,
	generateTicksNice,
	getDOMPosition,
	getMaxTextWidth,
	Padding,
} from './utils.js';

export default class Chart {
	userOptions!: ChartUserOptions;
	node!: HTMLElement;
	pointInfoDOM: HTMLElement | null = null;

	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	infoCanvas!: HTMLCanvasElement;
	infoCTX!: CanvasRenderingContext2D;
	crosshairCanvas!: HTMLCanvasElement;
	crosshairCTX!: CanvasRenderingContext2D;

	padding!: Padding & Record<string, number>;

	minPlotHeight = 200;
	minPlotWidth = 400;
	plotHeight = 0;
	plotWidth = 0;
	prevHeight = 0;
	prevWidth = 0;

	plotTop = 0;
	plotBottom = 0;
	plotLeft = 0;
	plotRight = 0;

	positions!: ReturnType<typeof getDOMPosition>;

	allPoints: ChartPoint[] = [];
	visiblePhases: import('./jdcharts.types.js').OhlcPhase[] = [];

	/** Filled by `setData()`. */
	chartData: ChartData = { ohlc: [] };

	isDragging = false;
	isCrosshair = true;
	prevIndex = -2;
	needsResize = false;
	hasRenderedOnce = false;

	draggingPos = 0;
	isResizingSeries = false;
	resizeSeries?: Series;

	plotHandler!: PlotHandler;
	DOMEventHandler!: DomEventHandler;

	series: Series[] = [];
	axes: Axis[] = [];
	xAxis: Axis[] = [];
	yAxis: Axis[] = [];

	header: HTMLElement | null = null;

	constructor(userOptions: ChartUserOptions) {
		const chart = this;
		const chartOptions = userOptions.chart;
		chart.userOptions = userOptions;
		chart.node = chartOptions.node;
		chart.pointInfoDOM = chart.node.querySelector('.chart-hud');

		chart.padding = Object.assign(new Padding(), chartOptions.padding ?? {}) as Padding & Record<string, number>;

		chart.plotHandler = new PlotHandler(chart);
		chart.series = [];
		chart.axes = [];
		chart.xAxis = [];
		chart.yAxis = [];

		chart.initDOM();
		chart.initCanvas();
		chart.setContainerSize();
		chart.initAxes();
		chart.initSeries();
		chart.initDOMEventHandler();

		chart.drawInstrumentHeader();

		chart.node.setAttribute('data-jdcharts', String(allCharts.length));
		allCharts.push(chart);
	}

	applyChartTypeChange(seriesType: string): void {
		const chart = this;
		const opt = chart.userOptions.series[0]!;
		opt.seriesType = seriesType;
		opt.index = 0;
		const SeriesClass = seriesTypes[seriesType];
		if (!SeriesClass) return;
		const series = new SeriesClass();
		series.init(chart, opt);
		chart.series[0] = series;
		chart.redraw();
	}

	initDOM(): void {
		const chart = this;
		chart.header = chart.node.querySelector('.chart-header');
	}

	initCanvas(): void {
		const chart = this;
		const chartPositions = getDOMPosition(chart.node);
		const minHeight = chart.minPlotHeight;
		const minWidth = chart.minPlotWidth;
		const height = chartPositions.height < minHeight ? minHeight : chartPositions.height;
		const width = chartPositions.width < minWidth ? minWidth : chartPositions.width;

		const makeCanvas = (): HTMLCanvasElement => {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			canvas.style.position = 'absolute';
			canvas.style.top = '0';
			canvas.style.left = '0';
			chart.node.appendChild(canvas);
			canvas.getContext('2d')!.translate(0.5, 0.5);
			return canvas;
		};

		const canvas = makeCanvas();
		chart.canvas = canvas;
		chart.ctx = canvas.getContext('2d')!;

		const infoCanvas = makeCanvas();
		chart.infoCanvas = infoCanvas;
		chart.infoCTX = infoCanvas.getContext('2d')!;

		const crosshairCanvas = makeCanvas();
		chart.crosshairCanvas = crosshairCanvas;
		chart.crosshairCTX = crosshairCanvas.getContext('2d')!;
	}

	/** Replace series data (OHLC + optional volume points). Does not fetch. */
	setData(data: ChartData): void {
		const ohlc = data.ohlc;
		this.chartData = {
			ohlc,
			volume: data.volume ?? ohlc.map((p) => ({ x: p.startTime, y: p.vol })),
		};
	}

	/** Demo/header wiring: timeframe, dataset label, chart type, padding. */
	applyConfigChange(newSettings: ConfigChange): void {
		const chart = this;
		const settings = (chart.userOptions.chartContext ??= {}) as ChartContext & Record<string, unknown>;

		const configType = newSettings.configType;

		if (configType === 'time') {
			settings.barType = String(newSettings.configVal);
			settings.barWidth = String(newSettings.val ?? '');
			return;
		}
		if (configType === 'charttype') {
			chart.applyChartTypeChange(String(newSettings.configVal));
			return;
		}
		if (configType === 'depth') {
			chart.yAxis[0]!.minPadding = Number(newSettings.configVal);
			chart.yAxis[0]!.maxPadding = Number(newSettings.configVal);
			chart.redraw();
			return;
		}
		if (configType === 'dataset') {
			const raw = String(newSettings.configVal);
			const parts = raw.split('::');
			const venueLabel = (parts[0] ?? '').toLowerCase();
			const symbol = parts[1] ?? 'BTCUSDT';
			const instrumentLabel = parts.slice(2).join('::') || symbol;
			settings.venueLabel = venueLabel;
			settings.symbol = symbol;
			settings.instrumentLabel = instrumentLabel;
			chart.drawInstrumentHeader();
			return;
		}
	}

	initSeries(): void {
		const chart = this;
		const seriesOptions = chart.userOptions.series;

		for (let i = 0; i < seriesOptions.length; i++) {
			const opt = seriesOptions[i]!;
			opt.index = i;
			const seriesType = opt.seriesType;
			const SeriesClass = seriesTypes[seriesType];
			if (!SeriesClass) continue;
			const series = new SeriesClass();
			series.init(chart, opt);
			chart.series.push(series);
		}
	}

	initAxes(): void {
		const chart = this;
		const xAxisOptions = chart.userOptions.xAxis;
		const yAxisOptions = chart.userOptions.yAxis;

		for (let i = 0; i < xAxisOptions.length; i++) {
			const opt = xAxisOptions[i]!;
			opt.isXAxis = true;
			opt.index = i;

			const axis = new Axis(chart, opt);
			chart.xAxis.push(axis);
		}

		for (let i = 0; i < yAxisOptions.length; i++) {
			const opt = yAxisOptions[i]!;
			opt.isXAxis = false;
			opt.index = i;

			const axis = new Axis(chart, opt);
			chart.yAxis.push(axis);
		}

		chart.axes = chart.xAxis.concat(chart.yAxis);

		for (let i = 0; i < chart.axes.length; i++) {
			chart.axes[i]!.initAxisHeightWidth();
		}
	}

	initDOMEventHandler(): void {
		const chart = this;
		const DOMEventHandler = new DomEventHandler(chart);
		DOMEventHandler.setDOMEvents();
		chart.DOMEventHandler = DOMEventHandler;
	}

	setContainerSize(): void {
		const chart = this;
		const chartPadding = chart.padding;
		const minHeight = chart.minPlotHeight;
		const minWidth = chart.minPlotWidth;

		chart.prevHeight = chart.plotHeight;
		chart.prevWidth = chart.plotWidth;

		const chartPositions = getDOMPosition(chart.node);
		chart.positions = chartPositions;
		const height = chartPositions.height < minHeight ? minHeight : chartPositions.height;
		const width = chartPositions.width < minWidth ? minWidth : chartPositions.width;

		chart.plotTop = chartPositions.top + chartPadding.top;
		chart.plotBottom = chartPositions.bottom - chartPadding.bottom;
		chart.plotLeft = chartPositions.left + chartPadding.left;
		chart.plotRight = chartPositions.right - chartPadding.right;
		chart.plotHeight = chart.plotBottom - chart.plotTop;
		chart.plotWidth = chart.plotRight - chart.plotLeft;

		chart.canvas.height = height;
		chart.canvas.width = width;
		chart.infoCanvas.height = height;
		chart.infoCanvas.width = width;
		chart.crosshairCanvas.height = height;
		chart.crosshairCanvas.width = width;
	}

	/** `mouseX`/`mouseY` are canvas-local (see `normalizeMouseEvent`), not document coords. */
	isInsidePlot(mouseX: number, mouseY: number): boolean {
		const chart = this;
		const xAxis = chart.xAxis[0];
		const y0 = chart.yAxis[0];
		const yLast = chart.yAxis[chart.yAxis.length - 1];
		if (!xAxis || !y0 || !yLast) return false;

		return (
			mouseX >= xAxis.pos.left &&
			mouseX <= xAxis.pos.right &&
			mouseY >= y0.pos.top &&
			mouseY <= yLast.pos.bottom
		);
	}

	async addSeries(settings: {
		yAxis: import('./jdcharts.types.js').AxisUserOptions & { heightInit: string };
		series: import('./jdcharts.types.js').SeriesUserOptions;
	}): Promise<void> {
		const chart = this;
		const numYAxis = chart.yAxis.length;
		const addedHeightInit = settings.yAxis.heightInit;
		const addedHeightPerc = parseFloat(String(addedHeightInit));

		for (let i = 0; i < numYAxis; i++) {
			const loopYAxis = chart.yAxis[i]!;
			const minus = loopYAxis.fullHeight * (addedHeightPerc / 100);
			loopYAxis.fullHeight = loopYAxis.fullHeight - minus;
			loopYAxis.height = loopYAxis.fullHeight - (loopYAxis.padding.top + loopYAxis.padding.bottom);
		}

		const yAxisOptions = settings.yAxis;
		yAxisOptions.isXAxis = false;
		yAxisOptions.index = chart.yAxis.length;

		const axis = new Axis(chart, yAxisOptions);
		chart.yAxis.push(axis);

		axis.fullHeight = (addedHeightPerc / 100) * (chart.plotHeight - chart.xAxis[0]!.fullHeight);
		axis.height = axis.fullHeight - (axis.padding.top + axis.padding.bottom);
		axis.width = chart.yAxis[0]!.width;
		axis.fullWidth = chart.yAxis[0]!.fullWidth;

		chart.axes = chart.xAxis.concat(chart.yAxis);

		const seriesOptions = settings.series;
		seriesOptions.index = chart.series.length;
		const seriesType = seriesOptions.seriesType;
		const SeriesClass = seriesTypes[seriesType];
		if (!SeriesClass) return;

		const series = new SeriesClass();
		series.init(chart, seriesOptions);
		chart.series.push(series);

		await chart.updateChart();
	}

	async updateChart(): Promise<void> {
		const chart = this;

		chart.toggleLoading(true);
		chart.editLoading();
		chart.prevIndex = -2;

		chart.ctx.clearRect(0, 0, chart.canvas.width, chart.canvas.height);

		try {
			chart.plotHandler.setDefaultVisibleRange();
			chart.hasRenderedOnce = true;
			chart.redraw();
		} catch (err) {
			const label = chart.userOptions.chartContext?.instrumentLabel ?? '';
			console.error('JDCharts: updateChart failed', err);
			chart.editLoading(`Error loading ${label || 'chart data'}`);
		} finally {
			chart.toggleLoading(false);
		}
	}

	redraw(): void {
		const chart = this;
		const plotHandler = chart.plotHandler;
		const rect = chart.node.getBoundingClientRect();
		const isVisible = rect.width > 0 && rect.height > 0;

		if (!isVisible) return;

		if (chart.hasRenderedOnce) {
			chart.ctx.clearRect(0, 0, chart.canvas.width, chart.canvas.height);

			chart.setContainerSize();
			chart.resizeAxis();
			// equalizeYAxisWidth mutates xAxis.width; updateAxisPos must run after so y-axis x
			// placement uses xAxis.pos.right + padding (see axis.ts).
			chart.equalizeYAxisWidth();
			chart.updateAxisPos();

			plotHandler.calcPointWidth();
			plotHandler.getPointPositions();

			chart.updateAxisTicks();
			chart.drawAxisLines();

			chart.drawSeriesPoints();
		}
	}

	equalizeYAxisWidth(): void {
		const chart = this;
		const allSeries = chart.series;
		let biggestWidth = 0;
		// Compare inner widths only: fullWidth includes padding, biggestWidth does not.
		// Using fullWidth here inflated diff and could grow xAxis.width when y-labels needed more room,
		// shoving the y-axis off the canvas.
		const oldInner = chart.yAxis[0]!.width;

		for (const series of allSeries) {
			const yAxis = series.yAxis;

			const paddedMax = yAxis.max + yAxis.max * yAxis.maxPadding;
			const paddedMin = yAxis.min - yAxis.min * yAxis.minPadding;

			let tickVals = generateTicksNice(paddedMin, paddedMax, yAxis.getEffectiveYTickCount());
			if (tickVals.length === 0) {
				tickVals = paddedMin === paddedMax ? [paddedMin] : [paddedMin, paddedMax];
			}

			const maxTextWidth = getMaxTextWidth(tickVals, yAxis.labels.fontSize, yAxis.ctx);
			const textPadding = yAxis.labels.textPadding ?? 0;
			const combinedWidth = maxTextWidth + yAxis.tickLength * 2 + textPadding * 2;
			const newAxisWidth = combinedWidth;

			biggestWidth = newAxisWidth > biggestWidth ? newAxisWidth : biggestWidth;
		}
		for (const series of allSeries) {
			const yAxis = series.yAxis;
			yAxis.width = biggestWidth;
			yAxis.fullWidth = yAxis.width + yAxis.padding.left + yAxis.padding.right;
		}

		const xAxis = chart.xAxis[0]!;
		const diff = oldInner - biggestWidth;
		xAxis.width = xAxis.width + diff;
		xAxis.fullWidth = xAxis.width + xAxis.padding.left + xAxis.padding.right;

		// Hard clamp: diff-based balance can widen the plot until the y-axis column is pushed past
		// the canvas edge (especially when label width shrinks and diff is positive). Reserve space
		// for the y column using canvas-local coordinates.
		const pad = chart.padding;
		const yCol = chart.yAxis[0]!.fullWidth;
		const maxInnerPlot = Math.max(
			0,
			chart.canvas.width -
				pad.left -
				pad.right -
				xAxis.padding.left -
				xAxis.padding.right -
				yCol,
		);
		if (xAxis.width > maxInnerPlot) {
			xAxis.width = maxInnerPlot;
			xAxis.fullWidth = xAxis.width + xAxis.padding.left + xAxis.padding.right;
		}
	}

	drawSeriesPoints(): void {
		const chart = this;
		const allSeries = chart.series;
		for (const series of allSeries) {
			series.drawPoints();
			series.seriesTab.updatePositions();
		}
	}

	updateAxisMinMax(): void {
		const chart = this;
		const allAxis = chart.axes;
		for (const axis of allAxis) {
			axis.updateMinMax();
		}
	}

	resizeAxis(): void {
		const chart = this;
		const allAxis = chart.axes;
		for (const axis of allAxis) {
			axis.resizeAxis();
		}
	}

	updateAxisPos(): void {
		const chart = this;
		for (const xAxis of chart.xAxis) {
			xAxis.updateXAxisHorizontalPos();
		}
		for (const yAxis of chart.yAxis) {
			yAxis.updateAxisPos();
		}
		for (const xAxis of chart.xAxis) {
			xAxis.updateXAxisVerticalPos();
		}
	}

	updateAxisTicks(): void {
		const chart = this;
		const allAxis = chart.axes;
		for (const axis of allAxis) {
			axis.makeAxis();
		}
	}

	drawAxisLines(): void {
		const chart = this;
		const allAxis = chart.axes;
		for (const axis of allAxis) {
			axis.drawAxisLines();
		}
	}

	toggleLoading(isLoading: boolean): void {
		const chart = this;
		const loadingElement = chart.node.querySelector('.chart-loading') as HTMLElement | null;
		if (!loadingElement) return;
		if (isLoading) {
			loadingElement.style.display = 'block';
		} else {
			loadingElement.style.display = 'none';
		}
	}

	editLoading(text?: string): void {
		const chart = this;
		const loadingElement = chart.node.querySelector('.chart-loading') as HTMLElement | null;
		if (!loadingElement) return;
		const msg = text === undefined ? 'Loading...' : text;
		const span = loadingElement.querySelector('span');
		if (span) span.textContent = msg;
	}

	drawInstrumentHeader(): void {
		const chart = this;
		const c = chart.userOptions.chartContext ?? {};

		const inst = String(c.instrumentLabel ?? '');
		const venue = String(c.venueLabel ?? '');
		const line = venue ? `${inst.toUpperCase()} - ${venue.toUpperCase()}` : inst.toUpperCase();

		const el = chart.node.querySelector('.chart-hud-title span');
		if (el) el.textContent = line;
	}

	drawOhlcReadout(closestPoint: ChartPoint): void {
		const chart = this;
		const openStr = 'O: ' + formatNumWidth(Number(closestPoint.phase.open));
		const highStr = ' H: ' + formatNumWidth(Number(closestPoint.phase.high));
		const lowStr = ' L: ' + formatNumWidth(Number(closestPoint.phase.low));
		const closeStr = ' C: ' + formatNumWidth(Number(closestPoint.phase.close));
		const volStr = ' V: ' + formatNumWidth(Number(closestPoint.phase.vol));

		let str = '';
		str += openStr;
		str += highStr;
		str += lowStr;
		str += closeStr;
		str += volStr;

		const candleInfoWrap = chart.pointInfoDOM?.querySelector('.chart-ohlc-readout');
		if (!candleInfoWrap) return;
		const candleInfoText = candleInfoWrap.querySelector('span');
		if (candleInfoText) candleInfoText.textContent = str;

		candleInfoWrap.classList.add('active');
	}

	drawCrosshairX(yPos: number): void {
		const chart = this;
		const ctx = chart.crosshairCTX;

		if (!chart.isCrosshair) return;

		const lineLeft = chart.xAxis[0]!.pos.left;
		const lineRight = chart.yAxis[0]!.pos.left;

		const d: (string | number)[] = ['M', lineLeft, yPos + 0.5, 'L', lineRight, yPos + 0.5];

		const pathStyle: CanvasPathStyle = {
			strokeColor: '#a5a5a5',
			lineWidth: 1,
		};

		drawCanvasPath(ctx, d, pathStyle);
	}

	drawCrosshairY(closestPoint: ChartPoint): void {
		const chart = this;
		const ctx = chart.crosshairCTX;

		if (!chart.isCrosshair) return;

		const lineTop = 0;
		const lineBottom = chart.xAxis[0]!.pos.top;

		const d: (string | number)[] = [
			'M',
			closestPoint.pos.middle,
			lineTop,
			'L',
			closestPoint.pos.middle,
			lineBottom,
		];

		const pathStyle: CanvasPathStyle = {
			strokeColor: '#a5a5a5',
			lineWidth: 1,
		};

		drawCanvasPath(ctx, d, pathStyle);
	}

	hideRenders(): void {
		const chart = this;
		const candleInfoWrap = chart.pointInfoDOM?.querySelector('.chart-ohlc-readout');
		candleInfoWrap?.classList.remove('active');

		chart.crosshairCTX.clearRect(0, 0, chart.crosshairCanvas.width, chart.crosshairCanvas.height);
		chart.infoCTX.clearRect(0, 0, chart.infoCanvas.width, chart.infoCanvas.height);
	}
}
