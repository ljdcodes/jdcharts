# JDCharts

Canvas charting (candlestick, volume, OHLC, line, area). Call **`chart.setData()`** with **`ChartData`**, then **`chart.updateChart()`**. There is no built-in feed. **`ChartContext`** is optional (header labels, bar interval).

## Scripts

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run preview
```

## Usage

```js
import JDCharts from 'jdcharts';
import type { ChartData } from 'jdcharts';

const jd = new JDCharts();
const chart = jd.createChart(options);

chart.setData(myChartData as ChartData);
await chart.updateChart();
```

## Source

[github.com/ljdcodes/jdcharts](https://github.com/ljdcodes/jdcharts) — clone for the demo; **`dist/`** is gitignored, so run **`npm run build`** first.
