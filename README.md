# JDCharts

Canvas charting for financial market data!

## Usage

```js
import JDCharts from 'jdcharts';
import type { ChartData } from 'jdcharts';

const jd = new JDCharts();
const chart = jd.createChart(options);

chart.setData(myChartData as ChartData);
await chart.updateChart();
```

## Scripts

```bash
npm install
npm run build
npm run preview
```

## Source

[github.com/ljdcodes/jdcharts](https://github.com/ljdcodes/jdcharts)
