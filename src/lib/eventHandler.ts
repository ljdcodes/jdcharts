// Created by James David

import type Chart from './chart.js';
import { getOffset } from './utils.js';

/** Pointer data derived from a DOM event — we use a plain object so we never mutate read-only WheelEvent fields. */
export type NormalizedChartPointer = {
	pageX: number;
	pageY: number;
	chartX: number;
	chartY: number;
	wheelDeltaY?: number;
};

export default class DomEventHandler {
	chart: Chart;
	lastMousePos = { x: -1, y: -1 };

	constructor(chart: Chart) {
		this.chart = chart;
	}

	setDOMEvents(): void {
		const DOMEventHandler = this;
		const chart = DOMEventHandler.chart;
		const mainCanvas = chart.canvas;
		const crosshairCanvas = chart.crosshairCanvas;
		const infoCanvas = chart.infoCanvas;

		const els = [mainCanvas, crosshairCanvas, infoCanvas];

		for (const chartEl of els) {
			chartEl.addEventListener('mousewheel', DOMEventHandler.onContainerMouseWheel.bind(DOMEventHandler));
			chartEl.addEventListener('DOMMouseScroll', DOMEventHandler.onContainerMouseWheel.bind(DOMEventHandler));
			chartEl.addEventListener('wheel', DOMEventHandler.onContainerMouseWheel.bind(DOMEventHandler));
			chartEl.addEventListener('mousedown', DOMEventHandler.onContainerMouseDown.bind(DOMEventHandler));
			chartEl.addEventListener('mouseup', DOMEventHandler.onContainerMouseUp.bind(DOMEventHandler));
			chartEl.addEventListener('mousemove', DOMEventHandler.onContainerMouseMove.bind(DOMEventHandler));
			chartEl.addEventListener('mouseleave', DOMEventHandler.onContainerMouseLeave.bind(DOMEventHandler));
			chartEl.addEventListener('click', DOMEventHandler.onContainerMouseClick.bind(DOMEventHandler));
			chartEl.addEventListener('resize', DOMEventHandler.onContainerResize.bind(DOMEventHandler));
		}

		window.addEventListener('mouseup', DOMEventHandler.onContainerMouseUp.bind(DOMEventHandler));
	}

	normalizeMouseEvent(e: Event): NormalizedChartPointer {
		const chart = this.chart;
		const me = e as MouseEvent;
		const mouseX = me.pageX;
		const mouseY = me.pageY;
		const offset = getOffset(chart.node);
		const chartX = mouseX - offset.left;
		const chartY = mouseY - offset.top;

		// Normalize to match WheelEvent.deltaY: positive = scroll down, negative = scroll up
		let wheelDeltaY: number | undefined;
		if (e.type === 'DOMMouseScroll') {
			wheelDeltaY = (e as WheelEvent).detail;
		} else if (e.type === 'wheel' || e.type === 'mousewheel') {
			const w = e as WheelEvent;
			if (typeof w.deltaY === 'number' && w.deltaY !== 0) {
				wheelDeltaY = w.deltaY;
			} else if (typeof (w as unknown as { wheelDelta?: number }).wheelDelta === 'number') {
				const wd = (w as unknown as { wheelDelta: number }).wheelDelta;
				// Legacy: wheelDelta > 0 = scroll up → invert to deltaY-like sign
				wheelDeltaY = -wd / 120;
			}
		}

		return { pageX: mouseX, pageY: mouseY, chartX, chartY, wheelDeltaY };
	}

	onContainerMouseClick(_e: MouseEvent): void {}

	onContainerMouseDown(e: MouseEvent): void {
		const DOMEventHandler = this;
		const chart = DOMEventHandler.chart;

		const ev = DOMEventHandler.normalizeMouseEvent(e);
		DOMEventHandler.resizeSeriesMousedown(ev);

		const insideX = ev.chartX ?? 0;
		const insideY = ev.chartY ?? 0;

		if (chart.isInsidePlot(insideX, insideY)) {
			const xAxis = chart.xAxis[0]!;
			const leftCheck = xAxis.pos.left;
			const rightCheck = xAxis.pos.right;
			const topCheck = chart.yAxis[0]!.pos.top;
			const bottomCheck = chart.yAxis[chart.yAxis.length - 1]!.pos.bottom;

			if (insideY >= topCheck && insideY <= bottomCheck && insideX >= leftCheck && insideX <= rightCheck) {
				chart.node.style.cursor = 'move';
				chart.isDragging = true;
				chart.draggingPos = insideX - xAxis.pos.left;
			}
		}
	}

	resizeSeriesMousedown(e: NormalizedChartPointer): void {
		const chart = this.chart;

		const insideY = e.chartY ?? 0;

		const lineWidth = 4;

		const allSeries = chart.series;

		for (const checkSeries of allSeries) {
			const checkYAxis = checkSeries.yAxis;
			const checkXAxis = checkSeries.xAxis;
			const checkPos = {
				bottomPos: checkYAxis.pos.bottom,
				leftPos: checkXAxis.pos.left,
				rightPos: checkXAxis.pos.right,
			};

			const isInsideLine =
				insideY > checkPos.bottomPos - lineWidth && insideY < checkPos.bottomPos + lineWidth;

			if (isInsideLine) {
				chart.isResizingSeries = true;
				chart.resizeSeries = checkSeries;
				break;
			}
		}
	}

	onContainerMouseUp(_e: MouseEvent): void {
		const chart = this.chart;
		chart.node.style.cursor = 'default';
		chart.isDragging = false;
		chart.isResizingSeries = false;
	}

	resizeSeriesMousemove(e: NormalizedChartPointer): void {
		const chart = this.chart;

		const insideY = e.chartY ?? 0;

		const allSeries = chart.series;
		const lineWidth = 4;

		for (const checkSeries of allSeries) {
			const checkYAxis = checkSeries.yAxis;
			const checkXAxis = checkSeries.xAxis;
			const checkPos = {
				bottomPos: checkYAxis.pos.bottom,
				leftPos: checkXAxis.pos.left,
				rightPos: checkXAxis.pos.right,
			};

			const isInsideLine =
				insideY > checkPos.bottomPos - lineWidth && insideY < checkPos.bottomPos + lineWidth;

			if (isInsideLine) {
				chart.crosshairCanvas.style.cursor = 'ns-resize';
				break;
			} else {
				chart.crosshairCanvas.style.cursor = 'default';
			}
		}
	}

	resizeSeries(e: NormalizedChartPointer): void {
		const chart = this.chart;

		if (chart.isResizingSeries) {
			const insideY = e.chartY ?? 0;

			const resizeSeries = chart.resizeSeries;
			if (!resizeSeries) return;

			const curBottom = resizeSeries.yAxis.pos.bottom;
			const curHeight = resizeSeries.yAxis.fullHeight;

			const diff = insideY - curBottom;

			resizeSeries.yAxis.fullHeight = curHeight + diff;
			resizeSeries.yAxis.height =
				resizeSeries.yAxis.fullHeight - (resizeSeries.yAxis.padding.top + resizeSeries.yAxis.padding.bottom);

			const otherSeries = chart.series[resizeSeries.index + 1];
			if (otherSeries) {
				otherSeries.yAxis.fullHeight = otherSeries.yAxis.fullHeight - diff;
				otherSeries.yAxis.height =
					otherSeries.yAxis.fullHeight - (otherSeries.yAxis.padding.top + otherSeries.yAxis.padding.bottom);
			}
			chart.redraw();
		}
	}

	checkMouseDiff(mouseX: number, mouseY: number): boolean {
		const DOMEventHandler = this;

		const lastMouseX = DOMEventHandler.lastMousePos.x;
		const lastMouseY = DOMEventHandler.lastMousePos.y;

		const yDiff = Math.abs(mouseY - lastMouseY);
		const xDiff = Math.abs(mouseX - lastMouseX);

		return xDiff >= 1 || yDiff >= 1;
	}

	onContainerMouseMove(e: MouseEvent): void {
		const DOMEventHandler = this;
		const chart = DOMEventHandler.chart;
		const plotHandler = chart.plotHandler;

		const ev = DOMEventHandler.normalizeMouseEvent(e);

		const mouseX = ev.pageX;
		const mouseY = ev.pageY;
		const insideX = ev.chartX ?? 0;
		const insideY = ev.chartY ?? 0;

		DOMEventHandler.resizeSeriesMousemove(ev);
		DOMEventHandler.resizeSeries(ev);

		if (!DOMEventHandler.checkMouseDiff(mouseX, mouseY)) {
			return;
		}

		chart.crosshairCTX.clearRect(0, 0, chart.crosshairCanvas.width, chart.crosshairCanvas.height);
		chart.infoCTX.clearRect(0, 0, chart.infoCanvas.width, chart.infoCanvas.height);

		if (chart.isInsidePlot(insideX, insideY)) {
			const closestPoint = plotHandler.getPoint(chart.allPoints, insideX);
			if (!closestPoint) {
				DOMEventHandler.lastMousePos.x = mouseX;
				DOMEventHandler.lastMousePos.y = mouseY;
				return;
			}
			const index = chart.visiblePhases.indexOf(closestPoint.phase);

			chart.drawCrosshairX(insideY);
			chart.drawCrosshairY(closestPoint);

			for (const axis of chart.axes) {
				const isXAxis = axis.isXAxis;

				if (isXAxis) {
					if (index !== chart.prevIndex && index >= 0) {
						chart.prevIndex = index;
						chart.drawOhlcReadout(closestPoint);
					}

					if (insideX >= axis.pos.left && insideX <= axis.pos.right) {
						const time = closestPoint.phase.startTime;
						axis.drawTimeBox(closestPoint.pos.middle, time);
					} else {
						chart.prevIndex = -2;
					}
				} else {
					if (insideY >= axis.pos.top && insideY <= axis.pos.bottom) {
						axis.drawYAxisFollow(insideY);
					}
				}
			}
		} else {
			chart.prevIndex = -2;
			chart.hideRenders();
		}

		if (chart.isDragging) {
			DOMEventHandler.handleDrag(insideX);
		}

		DOMEventHandler.lastMousePos.x = mouseX;
		DOMEventHandler.lastMousePos.y = mouseY;
	}

	handleDrag(xPos: number): void {
		const DOMEventHandler = this;
		const chart = DOMEventHandler.chart;
		const plotHandler = chart.plotHandler;
		const xAxis = chart.xAxis[0]!;

		const insideTimeX = xPos - xAxis.pos.left;
		let diff = insideTimeX - chart.draggingPos;
		const direction = diff < 0;
		diff = Math.abs(diff);

		if (diff !== 0 && diff > xAxis.fullPointWidth) {
			const shifts = Math.floor(diff / xAxis.fullPointWidth);

			chart.draggingPos = insideTimeX;
			plotHandler.shiftXAxis(shifts, direction);
			chart.redraw();
		}
	}

	onContainerMouseLeave(_e: MouseEvent): void {
		const DOMEventHandler = this;
		const chart = DOMEventHandler.chart;

		chart.hideRenders();
		DOMEventHandler.lastMousePos.x = -1;
		DOMEventHandler.lastMousePos.y = -1;
	}

	onContainerMouseWheel(e: Event): void {
		e.preventDefault();
		e.stopPropagation();

		const DOMEventHandler = this;
		const chart = DOMEventHandler.chart;
		const plotHandler = chart.plotHandler;

		const ev = DOMEventHandler.normalizeMouseEvent(e);

		if ((ev.wheelDeltaY ?? 0) === 0) return;

		const insideX = ev.chartX ?? 0;
		const insideY = ev.chartY ?? 0;

		const xAxis = chart.xAxis[0]!;
		const leftCheck = xAxis.pos.left;
		const rightCheck = xAxis.pos.right;
		const topCheck = chart.yAxis[0]!.pos.top;
		const bottomCheck = chart.yAxis[chart.yAxis.length - 1]!.pos.bottom;

		if (insideY >= topCheck && insideY <= bottomCheck && insideX >= leftCheck && insideX <= rightCheck) {
			// Standard WheelEvent: deltaY > 0 = scroll down → zoom out; deltaY < 0 = scroll up → zoom in
			const isZoomOut = (ev.wheelDeltaY ?? 0) > 0;
			plotHandler.changeZoomState(isZoomOut);
			chart.redraw();
		}
	}

	onContainerResize(_e: Event): void {}
}
