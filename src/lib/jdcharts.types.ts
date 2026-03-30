// Created by James David
//
// Types: OhlcPhase + ChartData (+ optional ChartContext). Data loading is app-side; see src/demo/ for an example.

/** One OHLC bar (renderer input). */
export interface OhlcPhase {
	startTime: number;
	endTime: number;
	open: number;
	high: number;
	low: number;
	close: number;
	vol: number;
}

/**
 * Payload for `chart.setData()`: OHLC series plus optional per-bar volume points for the volume pane.
 */
export interface ChartData {
	ohlc: OhlcPhase[];
	volume?: { x: number; y: number }[];
}

/** Optional header labels and bar interval; not required to draw. */
export interface ChartContext {
	barType: string;
	barWidth: string;
	/** Primary header label, e.g. instrument or series name. */
	instrumentLabel?: string;
	/** Secondary header label, e.g. data source or venue (optional). */
	venueLabel?: string;
	/** Optional symbol id for your own use (e.g. when driving a demo fetch). */
	symbol?: string;
}

export interface ChartPadding {
	top?: number;
	bottom?: number;
	left?: number;
	right?: number;
}

export interface ChartNodeOptions {
	node: HTMLElement;
	padding?: ChartPadding;
}

export interface SeriesUserOptions {
	seriesType: string;
	index: number;
	padding?: ChartPadding;
	indicatorSettings?: { icode?: string };
}

export interface AxisUserOptions {
	isXAxis?: boolean;
	index?: number;
	heightInit?: string | number;
	widthInit?: string | number;
	minPadding?: number;
	maxPadding?: number;
	numTicks: number;
	tickLength: number;
	tickStep?: number;
	range?: number;
	minRange?: number;
	padding?: ChartPadding;
	labels: AxisLabels;
}

export interface AxisLabels {
	fontSize: string;
	fontColor?: string;
	textPadding?: number;
}

export interface ChartUserOptions {
	chart: ChartNodeOptions;
	/** Bar interval + optional header strings; does not load data. */
	chartContext?: Partial<ChartContext>;
	xAxis: AxisUserOptions[];
	yAxis: AxisUserOptions[];
	series: SeriesUserOptions[];
}

export interface ChartOptions extends ChartUserOptions {}

export interface PointPosition {
	left: number;
	right: number;
	middle: number;
	topLeg: number;
	topBody: number;
	bottomBody: number;
	bottomLeg: number;
}

export interface ChartPoint {
	phase: OhlcPhase;
	pos: PointPosition;
}

export interface ConfigChange {
	configType: string;
	configVal: string | number;
	val?: string | number;
}
