// Created by James David

import type Chart from './chart.js';
import type { AxisLabels, AxisUserOptions } from './jdcharts.types.js';
import { drawCanvasPath, type CanvasPathStyle } from './render.js';
import {
	convertPercent,
	formatAxisTickNumber,
	formatNumWidth,
	formatTime,
	generateTicksNice,
	getMinMax,
	Padding,
	Positions,
} from './utils.js';
import type Series from './series.js';

export default class Axis {
	chart!: Chart;
	series!: Series;
	options!: AxisUserOptions;

	height = 0;
	width = 0;
	fullWidth = 0;
	fullHeight = 0;

	dataMin = 0;
	dataMax = 0;
	min = 0;
	max = 0;
	paddedMin = 0;
	paddedMax = 0;

	numTicks = 0;
	tickLength = 0;
	tickStep = 0;

	ticks: { position: number; val: number; point?: unknown }[] = [];

	isXAxis!: boolean;
	index!: number;

	heightInit?: string | number;
	widthInit?: string | number;

	minPadding = 0;
	maxPadding = 0;

	pos!: Positions;
	padding!: Padding & Record<string, number>;
	labels!: AxisLabels;

	fullPointWidth = 10;
	pointPadding = 4;
	pointWidth = 6;
	numPoints = 0;
	pixelWidthUnder = 0;
	missingPixelWidth = 0;
	range = 40;
	minRange = 40;

	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;

	/** Minimum vertical pixels per y-axis tick label; shorter axes get fewer ticks than `numTicks`. */
	static readonly DEFAULT_MIN_PIXELS_PER_Y_TICK = 28;

	constructor(chart: Chart, userOptions: AxisUserOptions) {
		const axis = this;
		axis.chart = chart;
		axis.options = userOptions;

		axis.pos = new Positions();
		axis.padding = Object.assign(new Padding(), userOptions.padding ?? {}) as Padding & Record<string, number>;
		axis.labels = userOptions.labels;

		axis.isXAxis = !!userOptions.isXAxis;
		axis.index = userOptions.index ?? 0;

		axis.heightInit = userOptions.heightInit;
		axis.widthInit = userOptions.widthInit;

		axis.minPadding = userOptions.minPadding ?? 0;
		axis.maxPadding = userOptions.maxPadding ?? 0;

		axis.numTicks = userOptions.numTicks;
		axis.tickLength = userOptions.tickLength;
		axis.tickStep = userOptions.tickStep ?? 0;

		if (axis.isXAxis) {
			axis.range = userOptions.range ?? 40;
			axis.minRange = userOptions.minRange ?? 40;
		}

		axis.canvas = document.createElement('canvas');
		axis.ctx = axis.canvas.getContext('2d')!;
		axis.ctx.font = axis.labels.fontSize + ' Monospace';
	}

	/**
	 * Effective tick count for `generateTicksNice`: at most `numTicks`, and at most what fits in
	 * `height` (so e.g. the volume row stays readable).
	 */
	getEffectiveYTickCount(): number {
		const axis = this;
		const requested = Math.max(2, axis.numTicks);
		const h = axis.height;
		if (h <= 0) return requested;
		const maxByHeight = Math.max(2, Math.floor(h / Axis.DEFAULT_MIN_PIXELS_PER_Y_TICK));
		return Math.min(requested, maxByHeight);
	}

	updateMinMax(): void {
		const axis = this;
		const chart = axis.chart;
		const isXAxis = axis.isXAxis;
		const allPhases = chart.chartData.ohlc;
		const visiblePhases = chart.visiblePhases;

		if (!allPhases.length || !visiblePhases.length) {
			return;
		}

		if (isXAxis) {
			axis.dataMin = allPhases[0]!.startTime;
			axis.dataMax = allPhases[allPhases.length - 1]!.startTime;

			axis.min = visiblePhases[0]!.startTime;
			axis.max = visiblePhases[visiblePhases.length - 1]!.startTime;
		} else {
			if (axis.series.usesMainData || axis.series.isMainSeries) {
				const minMax = getMinMax(visiblePhases, axis.index === 0);
				axis.min = minMax[0];
				axis.max = minMax[1];
			} else {
				const fd = axis.series.formattedData;
				axis.min = fd.min;
				axis.max = fd.max;
			}
		}

		axis.paddedMax = axis.max + axis.max * axis.maxPadding;
		axis.paddedMin = axis.min - axis.min * axis.minPadding;
	}

	initAxisHeightWidth(): void {
		const axis = this;
		const chart = axis.chart;
		const isXAxis = axis.isXAxis;

		const wrapWidth = chart.plotWidth;
		const wrapHeight = chart.plotHeight;

		let convertedHeight: number;
		let convertedWidth: number;

		if (isXAxis) {
			convertedHeight = convertPercent(axis.heightInit ?? '0', wrapHeight);
			// Cap strip: raw % (e.g. 15%) on a tall chart is far more than ~12px text needs.
			const stripMax = Math.min(wrapHeight * 0.12, 36);
			convertedHeight = Math.min(convertedHeight, stripMax);
			convertedWidth = convertPercent('100%', wrapWidth);
			convertedWidth = convertedWidth - (50 + axis.padding.left + axis.padding.right);
		} else {
			const xAxis = chart.xAxis[0]!;
			const ys = chart.yAxis;

			// Split (plot height minus x-axis strip) by heightInit weights (e.g. 70 vs 22).
			// Old formula did % of full height minus xAxis/n per pane — that never summed to plotHeight,
			// leaving a dead band below the x-axis and making volume look "too high" vs the bottom line.
			const yStack = Math.max(0, wrapHeight - xAxis.fullHeight);
			const weights = ys.map((y) => {
				const n = parseFloat(String(y.heightInit ?? '1').replace(/%/g, ''));
				return Number.isFinite(n) && n > 0 ? n : 1;
			});
			const sumW = weights.reduce((a, b) => a + b, 0);
			const segment = yStack * (weights[axis.index]! / sumW);
			convertedHeight = segment - (axis.padding.top + axis.padding.bottom);

			convertedWidth = convertPercent(axis.widthInit ?? '0', wrapWidth);
		}

		axis.height = convertedHeight;
		axis.width = convertedWidth;
		axis.fullWidth = convertedWidth + axis.padding.left + axis.padding.right;
		axis.fullHeight = convertedHeight + axis.padding.top + axis.padding.bottom;
	}

	resizeAxis(): void {
		const axis = this;
		const chart = axis.chart;
		const isXAxis = axis.isXAxis;

		const prevHeight = chart.prevHeight;
		const prevWidth = chart.prevWidth;
		const plotHeight = chart.plotHeight;
		const plotWidth = chart.plotWidth;
		const diffHeight = plotHeight - prevHeight;
		const diffWidth = plotWidth - prevWidth;

		if (!isXAxis) {
			const xAxis = chart.xAxis[0]!;
			const denom = prevHeight - xAxis.fullHeight;
			if (denom > 0.5) {
				axis.fullHeight = axis.fullHeight + (axis.fullHeight / denom) * diffHeight;
			} else if (diffHeight !== 0) {
				const yStack = Math.max(0, plotHeight - xAxis.fullHeight);
				const ys = chart.yAxis;
				const weights = ys.map((y) => {
					const n = parseFloat(String(y.heightInit ?? '1').replace(/%/g, ''));
					return Number.isFinite(n) && n > 0 ? n : 1;
				});
				const sumW = weights.reduce((a, b) => a + b, 0);
				const segment = yStack * (weights[axis.index]! / sumW);
				axis.fullHeight = segment;
			}
			axis.height = axis.fullHeight - (axis.padding.top + axis.padding.bottom);
		} else {
			const wrapHeight = plotHeight;
			let h = convertPercent(axis.heightInit ?? '15%', wrapHeight);
			const stripMax = Math.min(wrapHeight * 0.12, 36);
			h = Math.min(h, stripMax);
			axis.height = Math.max(0, h);
			axis.fullHeight = axis.height + axis.padding.top + axis.padding.bottom;
			axis.fullWidth = axis.fullWidth + diffWidth;
			axis.width = axis.fullWidth - (axis.padding.left + axis.padding.right);
		}
	}

	/** Left/right for the x-axis; call before y `updateAxisPos` so y-axes can read `xAxis.pos.right`. */
	updateXAxisHorizontalPos(): void {
		const axis = this;
		const chart = axis.chart;
		const chartPadding = chart.padding;

		axis.pos.left = axis.padding.left + chartPadding.left;
		axis.pos.right = axis.pos.left + axis.width;
	}

	/**
	 * Stack the x-axis directly under the last y-axis. Anchoring to `canvas.height - height` left a
	 * dead band whenever y-height math did not exactly fill the plot above the x strip.
	 */
	updateXAxisVerticalPos(): void {
		const axis = this;
		const chart = axis.chart;
		const ys = chart.yAxis;
		const padB = chart.padding.bottom;

		if (ys.length === 0) {
			const h = chart.canvas.height;
			axis.pos.top = Math.max(0, h - padB - axis.height);
			axis.pos.bottom = Math.min(h - padB, axis.pos.top + axis.height);
			return;
		}

		const lastY = ys[ys.length - 1]!;
		axis.pos.top = lastY.pos.bottom;
		axis.pos.bottom = axis.pos.top + axis.height;
	}

	updateAxisPos(): void {
		const axis = this;
		const chart = axis.chart;
		const chartPadding = chart.padding;
		const isXAxis = axis.isXAxis;

		if (isXAxis) {
			return;
		}

		const xAxis = chart.xAxis[0]!;
		const axisIndex = axis.index;

		const leftAdd = xAxis.padding.left + xAxis.width;
		let topAdd = 0;

		if (axisIndex > 0) {
			const otherAxis = chart.yAxis[axisIndex - 1]!;
			topAdd += otherAxis.pos.bottom;
		}

		axis.pos.top = axis.padding.top + topAdd + chartPadding.top / chart.yAxis.length;
		axis.pos.bottom = axis.pos.top + axis.height;
		// Place y-axis immediately right of the plot strip: x inner edge + x right padding (not
		// xAxis.fullWidth + chartPadding, which mixed coordinate spaces with equalizeYAxisWidth).
		axis.pos.left = xAxis.pos.right + xAxis.padding.right + axis.padding.left;
		axis.pos.right = axis.pos.left + axis.width;
	}

	makeAxis(): void {
		const axis = this;
		const chart = axis.chart;
		const isXAxis = axis.isXAxis;

		const ticksLeft: { x: number; y: number }[] = [];
		const ticksRight: { x: number; y: number }[] = [];
		const labels: { text: string; x: number; y: number }[] = [];
		const gridLines: { x: number; y: number }[] = [];

		let ticksDom: { x: number; y: number }[] = [];

		if (isXAxis) {
			const ticks = axis.getXAxisTicks();
			const yPos = axis.pos.top;

			for (const tick of ticks) {
				const xPos = tick.position;

				labels.push({
					text: formatTime(new Date(tick.val)),
					x: xPos,
					y: yPos,
				});

				ticksDom.push({
					x: xPos,
					y: yPos,
				});
			}
		} else {
			const ticks = axis.getYAxisTicks();
			const xPos = axis.pos.left;

			for (const tick of ticks) {
				const yPos = tick.position + 0.5;
				const text = formatAxisTickNumber(tick.val);

				labels.push(axis.calcLabelPosition(xPos, yPos, text));

				ticksLeft.push(axis.calcLeftTickPosition(xPos, yPos));
				ticksRight.push(axis.calcRightTickPosition(xPos, yPos));
				gridLines.push(axis.calcGridlinePosition(xPos, yPos));
			}
		}

		const ctx = chart.ctx;
		const tickLength = axis.tickLength;

		const tickPathStyle: CanvasPathStyle = {
			strokeColor: '#8E909C',
			lineWidth: 0.5,
		};

		if (isXAxis) {
			for (const label of labels) {
				ctx.font = axis.labels.fontSize + ' Roboto';
				ctx.fillStyle = axis.labels.fontColor ?? '#8C8C8C';
				ctx.fillText(label.text, label.x - 20, label.y + 16);
			}

			for (const tickDom of ticksDom) {
				const d: (string | number)[] = ['M', tickDom.x, tickDom.y, 'L', tickDom.x, tickDom.y + tickLength];

				drawCanvasPath(ctx, d, tickPathStyle);
			}
		} else {
			for (const label of labels) {
				ctx.font = axis.labels.fontSize + ' Roboto';
				ctx.fillStyle = axis.labels.fontColor ?? '#8C8C8C';
				ctx.fillText(label.text, label.x, label.y + 4);
			}

			for (const tickLeft of ticksLeft) {
				const d: (string | number)[] = [
					'M',
					tickLeft.x,
					tickLeft.y,
					'L',
					tickLeft.x + tickLength,
					tickLeft.y,
				];
				drawCanvasPath(ctx, d, tickPathStyle);
			}

			for (const tickRight of ticksRight) {
				const d: (string | number)[] = [
					'M',
					tickRight.x,
					tickRight.y,
					'L',
					tickRight.x - tickLength,
					tickRight.y,
				];
				drawCanvasPath(ctx, d, tickPathStyle);
			}

			for (const gridLine of gridLines) {
				const pathStyle: CanvasPathStyle = {
					strokeColor: '#404040',
					lineWidth: 1,
					lineDash: [1, 3],
				};

				const d: (string | number)[] = ['M', 0, gridLine.y, 'L', gridLine.x, gridLine.y];

				drawCanvasPath(ctx, d, pathStyle);
			}
		}
	}

	getXAxisTicks(): { position: number; val: number; point?: unknown }[] {
		const axis = this;
		const chart = axis.chart;

		const tickStep = axis.tickStep;
		let tickStepStart = 0;

		const allPoints = chart.allPoints;
		const allPointsLength = allPoints.length;

		if (allPointsLength === 0) {
			axis.ticks = [];
			return [];
		}

		const prevTicks = axis.ticks;

		const numTicks = Math.floor(axis.width / tickStep);
		let tickJump = Math.floor(numTicks / axis.fullPointWidth);

		tickJump = tickJump < 1 ? 1 : tickJump;

		let index = -1;

		for (const tick of prevTicks) {
			for (let j = 0; j < allPointsLength; j++) {
				const point = allPoints[j]!;

				if (point.phase.startTime === tick.val) {
					index = j;
					break;
				}
			}

			if (index !== -1) {
				tickStepStart = index - tickJump < 0 ? index : index - tickJump;
				break;
			}
		}

		const ticks: { position: number; val: number; point?: unknown }[] = [];
		axis.ticks = [];

		const showTicks: typeof allPoints = [];

		if (tickStep >= allPointsLength) {
			index = Math.floor((allPointsLength - 1) / 2);
			showTicks.push(allPoints[index]!);
		} else {
			let tickStepPos = tickStepStart;

			while (tickStepPos < allPointsLength) {
				showTicks.push(allPoints[tickStepPos]!);
				tickStepPos += tickJump;
			}
		}

		for (const showTick of showTicks) {
			ticks.push({
				position: showTick.pos.middle,
				val: showTick.phase.startTime,
				point: showTick,
			});
		}

		axis.ticks = ticks;

		return ticks;
	}

	getYAxisTicks(): { position: number; val: number }[] {
		const axis = this;
		const ticks: { position: number; val: number }[] = [];

		const paddedMax = axis.paddedMax;
		const paddedMin = axis.paddedMin;

		let tickVals = generateTicksNice(paddedMin, paddedMax, axis.getEffectiveYTickCount());
		if (tickVals.length === 0) {
			tickVals = paddedMin === paddedMax ? [paddedMin] : [paddedMin, paddedMax];
		}

		for (let i = 0; i < tickVals.length; i++) {
			const tickVal = tickVals[i]!;
			const position = axis.getPositionFromValue(tickVal);

			ticks.push({ position, val: tickVal });
		}

		axis.ticks = ticks;

		return ticks;
	}

	calcLabelPosition(xPos: number, yPos: number, text: string) {
		const axis = this;
		axis.ctx.font = axis.labels.fontSize + ' Roboto';
		const ticks = axis.ticks;
		let maxTextWidth = 0;

		for (const tick of ticks) {
			const loopText = formatAxisTickNumber(tick.val);
			const wid = axis.ctx.measureText(loopText).width;
			maxTextWidth = wid > maxTextWidth ? wid : maxTextWidth;
		}

		const tickLength = axis.tickLength;
		const fixedTextPadding = axis.labels.textPadding ?? 0;

		const textWidth = axis.ctx.measureText(text).width;
		const diff = maxTextWidth - textWidth;
		let shift = 0;

		const wrapWidth = tickLength * 2 + fixedTextPadding * 2;
		const pad = (axis.width - wrapWidth) / 2 - maxTextWidth / 2;

		if (diff >= 1) {
			shift = diff / 2;
		}

		if (pad >= 0.5) {
			shift += pad;
		}

		return {
			text,
			y: yPos,
			x: xPos + shift + fixedTextPadding + tickLength,
		};
	}

	calcLeftTickPosition(xPos: number, yPos: number) {
		return { x: xPos, y: yPos };
	}

	calcRightTickPosition(xPos: number, yPos: number) {
		const axis = this;
		return {
			y: yPos,
			x: xPos + axis.width,
		};
	}

	calcGridlinePosition(xPos: number, yPos: number) {
		return {
			y: yPos,
			x: xPos,
		};
	}

	drawAxisLines(): void {
		const axis = this;
		const chart = axis.chart;
		const isXAxis = axis.isXAxis;
		const ctx = chart.ctx;

		const pathStyle: CanvasPathStyle = {
			strokeColor: '#555555',
			lineWidth: 1,
		};

		// Canvas uses element pixel coordinates (0..canvas.width). Do not use getBoundingClientRect()
		// (viewport CSS pixels) or axis lines and spans render in the wrong place or clip away.
		const cw = chart.canvas.width;

		if (isXAxis) {
			let d: (string | number)[] = ['M', 0, axis.pos.top + 0.5, 'L', cw, axis.pos.top + 0.5];
			drawCanvasPath(ctx, d, pathStyle);

			d = ['M', 0, axis.pos.bottom + 0.5, 'L', cw, axis.pos.bottom + 0.5];
			drawCanvasPath(ctx, d, pathStyle);
		} else {
			let d: (string | number)[] = ['M', 0, axis.pos.bottom + 0.5, 'L', cw, axis.pos.bottom + 0.5];
			drawCanvasPath(ctx, d, pathStyle);

			d = ['M', axis.pos.left + 0.5, 0, 'L', axis.pos.left + 0.5, axis.pos.bottom];
			drawCanvasPath(ctx, d, pathStyle);
		}
	}

	drawYAxisFollow(mousePosY: number): void {
		const axis = this;
		const chart = axis.chart;
		const ctx = chart.infoCTX;

		const rightPos = axis.pos.right - 1;
		let leftPos = axis.pos.left;
		const topPos = mousePosY - 8;
		const bottomPos = topPos + 18;
		const yMiddlePos = topPos + (bottomPos - topPos) / 2 + 0.5;
		const leftPosPad = leftPos + 7;

		const d: (string | number)[] = [
			'M',
			rightPos,
			topPos,
			'L',
			leftPosPad,
			topPos,
			'L',
			leftPos,
			yMiddlePos,
			'L',
			leftPosPad,
			bottomPos,
			'L',
			rightPos,
			bottomPos,
			'L',
			rightPos,
			topPos,
		];

		const ps: CanvasPathStyle = {
			strokeColor: '#D3D3D3',
			lineWidth: 1,
			fillColor: 'black',
		};

		drawCanvasPath(ctx, d, ps);

		leftPos = axis.pos.left;
		const width = axis.width;

		const insideY = mousePosY - axis.pos.top;
		let val = axis.getValueFromPosition(insideY);
		val = formatNumWidth(Number(val));

		const textWidth = axis.ctx.measureText(String(val)).width;
		const move = (width - textWidth) / 2;

		ctx.font = '12px Roboto';
		ctx.fillStyle = '#D3D3D3';

		ctx.fillText(String(val), leftPos + move, mousePosY + 6);
	}

	drawTimeBox(mousePosX: number, time: number): void {
		const axis = this;
		const chart = axis.chart;
		const ctx = chart.infoCTX;
		const timeStr = formatTime(new Date(time), true);

		const leftPos = mousePosX - 55;
		const rightPos = leftPos + 110;
		// Short chip — do not use full axis.height or the hover box fills the x strip / black gap.
		const boxH = 22;
		const insetFromStripBottom = 5;
		let bottomPos = axis.pos.bottom - insetFromStripBottom;
		let topPos = bottomPos - boxH;
		const stripTop = axis.pos.top + 1;
		if (topPos < stripTop) {
			topPos = stripTop;
			bottomPos = topPos + boxH;
		}

		const d: (string | number)[] = [
			'M',
			leftPos,
			topPos,
			'L',
			rightPos,
			topPos,
			'L',
			rightPos,
			bottomPos,
			'L',
			leftPos,
			bottomPos,
			'Z',
		];

		const pathStyle: CanvasPathStyle = {
			strokeColor: '#a5a5a5',
			lineWidth: 1,
			fillColor: 'black',
		};

		drawCanvasPath(ctx, d, pathStyle);

		ctx.font = '13px Roboto';
		ctx.fillStyle = '#D3D3D3';

		ctx.fillText(String(timeStr), mousePosX - 37, topPos + 15);
	}

	getPositionFromValue(pointValue: number): number {
		const axis = this;

		const paddedMax = axis.max + axis.max * axis.maxPadding;
		const paddedMin = axis.min - axis.min * axis.minPadding;

		const num = pointValue - paddedMin;
		const range = paddedMax - paddedMin;
		const ratio = num / range;
		const pos = Number((axis.pos.bottom - ratio * axis.height).toFixed(4));

		return pos;
	}

	getValueFromPosition(pos: number): number {
		const axis = this;

		const isXAxis = axis.isXAxis;
		const paddedMax = axis.max + axis.max * axis.maxPadding;
		const paddedMin = axis.min - axis.min * axis.minPadding;

		const range = paddedMax - paddedMin;
		const ratio = isXAxis ? pos / axis.width : pos / axis.height;
		const num = ratio * range;
		const val = isXAxis ? paddedMin + num : paddedMax - num;

		return val;
	}
}
