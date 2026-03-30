// Created by James David

import type Chart from './chart.js';
import type { ChartPoint, OhlcPhase } from './jdcharts.types.js';

export default class PlotHandler {
	chart: Chart;
	visStartIndex = 0;
	visEndIndex = 0;
	visiblePhases: OhlcPhase[] = [];

	constructor(chart: Chart) {
		this.chart = chart;
	}

	setDefaultVisibleRange(): void {
		const chart = this.chart;
		const xAxis = chart.xAxis[0]!;

		const allPhases = chart.chartData.ohlc;
		const allPhasesLength = allPhases.length;
		if (allPhasesLength === 0) {
			this.visStartIndex = 0;
			this.visEndIndex = -1;
			this.visiblePhases = [];
			chart.visiblePhases = [];
			return;
		}

		const range = xAxis.range ?? 40;
		const minRange = xAxis.minRange ?? 40;

		const _startIndex = allPhasesLength > range ? allPhasesLength - range : 0;
		const endIndex = allPhasesLength - 1;

		void minRange;
		this.setVisiblePoints(_startIndex, endIndex);
	}

	calcPointWidth(): void {
		const chart = this.chart;
		const xAxis = chart.xAxis[0]!;

		const currentEndIndex = this.visEndIndex;
		const xAxisWidth = xAxis.width;
		const fullPointWidth = xAxis.fullPointWidth;

		const numPhases = Math.floor(xAxisWidth / fullPointWidth);
		let newStartIndex = currentEndIndex - numPhases + 1;
		let numMissingPoints = 0;

		if (newStartIndex < 0) {
			numMissingPoints = Math.abs(newStartIndex);
			newStartIndex = 0;
		}

		const missingPixelWidth = numMissingPoints * fullPointWidth;
		const realNumPhases = currentEndIndex - newStartIndex + 1;
		const pixelWidthUnder = xAxisWidth - realNumPhases * fullPointWidth - missingPixelWidth;

		xAxis.numPoints = Math.ceil(xAxisWidth / fullPointWidth);
		xAxis.pixelWidthUnder = pixelWidthUnder;
		xAxis.missingPixelWidth = missingPixelWidth;

		this.setVisiblePoints(newStartIndex, currentEndIndex);
	}

	setVisiblePoints(startIndex: number, endIndex: number): void {
		const chart = this.chart;
		const allPhases = chart.chartData.ohlc;

		this.visStartIndex = startIndex;
		this.visEndIndex = endIndex;
		this.visiblePhases = allPhases.slice(startIndex, endIndex + 1);
		chart.visiblePhases = this.visiblePhases;
		chart.updateAxisMinMax();
	}

	getPointPositions(): void {
		const chart = this.chart;
		const xAxis = chart.xAxis[0]!;
		const priceAxis = chart.yAxis[0]!;

		let xPos = Math.floor(xAxis.pos.left + xAxis.pixelWidthUnder);

		const phases = chart.visiblePhases;

		const fullPointWidth = xAxis.fullPointWidth;
		const pointWidth = xAxis.pointWidth;

		const allPoints: ChartPoint[] = [];

		const isFullOdd = pointWidth % 2 !== 0;

		if (!isFullOdd) xPos += 0.5;

		for (const phase of phases) {
			const closedHigher = phase.close > phase.open;

			const top = closedHigher ? phase.close : phase.open;
			const bottom = closedHigher ? phase.open : phase.close;

			let bottomBody = priceAxis.getPositionFromValue(bottom);
			const bottomLeg = priceAxis.getPositionFromValue(phase.low);
			let topBody = priceAxis.getPositionFromValue(top);
			const topLeg = priceAxis.getPositionFromValue(phase.high);

			let left = xPos;
			let right = left + pointWidth;
			const middle = (left + right) / 2;

			topBody = Math.floor(topBody) + 0.5;
			bottomBody = Math.floor(bottomBody) + 0.5;

			if (isFullOdd) {
				left += 0.5;
				right -= 0.5;
			}

			const positions = {
				left,
				right,
				middle,
				topLeg,
				topBody,
				bottomBody,
				bottomLeg,
			};

			allPoints.push({ phase, pos: positions });

			xPos += fullPointWidth;
		}

		chart.allPoints = allPoints;
	}

	changeZoomState(isZoomOut: boolean): void {
		const chart = this.chart;
		const xAxis = chart.xAxis[0]!;

		const currentEndIndex = this.visEndIndex;
		const xAxisWidth = xAxis.width;
		const zoomState = xAxis.fullPointWidth;

		const zoomStates = [2, 3, 4, 5, 6, 7, 10, 13, 15, 17, 20, 25, 30, 40, 50];
		const zoomIndex = zoomStates.indexOf(zoomState);
		const newIndex = isZoomOut ? zoomIndex - 1 : zoomIndex + 1;

		if (newIndex < 0 || newIndex >= zoomStates.length) {
			return;
		}

		const fullPointWidth = zoomStates[newIndex]!;
		const numPhases = Math.floor(xAxisWidth / fullPointWidth);
		let newStartIndex = currentEndIndex - numPhases + 1;
		let numMissingPoints = 0;

		if (newStartIndex < 0) {
			numMissingPoints = Math.abs(newStartIndex);
			newStartIndex = 0;
		}

		let newEndIndex = currentEndIndex;
		if (isZoomOut) {
			const maxEnd = chart.chartData.ohlc.length - 1;
			const visibleCount = newEndIndex - newStartIndex + 1;
			if (visibleCount < numPhases && newEndIndex < maxEnd) {
				newEndIndex = Math.min(newStartIndex + numPhases - 1, maxEnd);
			}
		}

		const missingPixelWidth = numMissingPoints * fullPointWidth;
		const realNumPhases = newEndIndex - newStartIndex + 1;
		const pixelWidthUnder = xAxisWidth - realNumPhases * fullPointWidth - missingPixelWidth;

		let pointPadding = 1;

		if (fullPointWidth >= 3) pointPadding = 2;
		if (fullPointWidth >= 6) pointPadding = 3;
		if (fullPointWidth >= 10) pointPadding = 4;
		if (fullPointWidth >= 15) pointPadding = 5;
		if (fullPointWidth >= 20) pointPadding = 6;
		if (fullPointWidth >= 30) pointPadding = 8;
		if (fullPointWidth >= 100) pointPadding = 20;

		const pointWidth = fullPointWidth - pointPadding;

		xAxis.fullPointWidth = fullPointWidth;
		xAxis.pointWidth = pointWidth;
		xAxis.pointPadding = pointPadding;
		xAxis.numPoints = Math.ceil(xAxisWidth / fullPointWidth);
		xAxis.pixelWidthUnder = pixelWidthUnder;
		xAxis.missingPixelWidth = missingPixelWidth;

		this.setVisiblePoints(newStartIndex, newEndIndex);
	}

	shiftXAxis(shifts: number, direction: boolean): void {
		const chart = this.chart;

		const allPhases = chart.chartData.ohlc;
		const allPhasesLength = allPhases.length;
		const currentStartIndex = this.visStartIndex;
		const currentEndIndex = this.visEndIndex;

		let toShift = false;
		let newStartIndex = -1;
		let newEndIndex = -1;
		const signedShifts = direction ? shifts : shifts * -1;

		if (direction === false) {
			if (currentStartIndex > 0) {
				let diff = currentStartIndex + signedShifts;
				let fixedShifts = diff < 0 ? diff : 0;
				fixedShifts = signedShifts - fixedShifts;
				newStartIndex = currentStartIndex + fixedShifts;
				newEndIndex = currentEndIndex + fixedShifts;
				toShift = true;
			}
		} else {
			if (currentEndIndex < allPhasesLength - 1) {
				let diff = currentEndIndex + signedShifts;
				let fixedShifts = diff > allPhasesLength - 1 ? diff - (allPhasesLength - 1) : 0;
				fixedShifts = signedShifts - fixedShifts;
				newStartIndex = currentStartIndex + fixedShifts;
				newEndIndex = currentEndIndex + fixedShifts;
				toShift = true;
			}
		}

		if (toShift) {
			this.setVisiblePoints(newStartIndex, newEndIndex);
			this.calcPointWidth();
		}
	}

	getPoint(points: ChartPoint[], value: number): ChartPoint | null {
		if (points.length === 0) return null;

		let val: ChartPoint | null = null;

		if (value >= points[points.length - 1]!.pos.left) {
			val = points[points.length - 1]!;
		} else if (value <= points[0]!.pos.left) {
			val = points[0]!;
		} else {
			for (let i = 0; i < points.length; i++) {
				const point = points[i]!;
				if (point.pos.left >= value) {
					const prev = points[i - 1]!;
					const firstDiff = Math.abs(value - prev.pos.right);
					const secondDiff = Math.abs(value - point.pos.left);
					val = firstDiff <= secondDiff ? prev : point;
					break;
				}
			}
		}

		return val;
	}
}
