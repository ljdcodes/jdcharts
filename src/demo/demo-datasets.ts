// Demo-only symbols for the sample loader (`venue::symbol::label` → `Chart.applyConfigChange`).

/** Encoded for `changeSettings({ configType: 'dataset', configVal })` */
export type DemoDataset = {
	id: string;
	label: string;
	payload: string;
};

export const DEMO_DATASETS: readonly DemoDataset[] = [
	{ id: 'btc', label: 'BTC', payload: 'binance::BTCUSDT::BTC / USDT' },
	{ id: 'eth', label: 'ETH', payload: 'binance::ETHUSDT::ETH / USDT' },
	{ id: 'gold', label: 'Gold', payload: 'binance::PAXGUSDT::Gold / USDT' },
	{ id: 'silver', label: 'Silver', payload: 'demo::SILVER::Silver' },
] as const;

export function getDemoDatasetById(id: string): DemoDataset | undefined {
	return DEMO_DATASETS.find((d) => d.id === id);
}
