// Curated Binance spot symbols for the demo loader.

/** `venueLabel::symbol::instrumentLabel` — parsed in `Chart.applyConfigChange` (`dataset`); demo-only. */
export type DemoDataset = {
	id: string;
	label: string;
	/** Encoded for `changeSettings({ configType: 'dataset', configVal })` */
	payload: string;
};

export const DEMO_DATASETS: readonly DemoDataset[] = [
	{ id: 'btc', label: 'Bitcoin (BTC)', payload: 'binance::BTCUSDT::Bitcoin / USDT' },
	{ id: 'eth', label: 'Ethereum (ETH)', payload: 'binance::ETHUSDT::Ethereum / USDT' },
	{ id: 'gold', label: 'Gold (PAXG)', payload: 'binance::PAXGUSDT::Gold (PAXG) / USDT' },
	{ id: 'sol', label: 'Solana (SOL)', payload: 'binance::SOLUSDT::Solana / USDT' },
	{ id: 'doge', label: 'Dogecoin (DOGE)', payload: 'binance::DOGEUSDT::Dogecoin / USDT' },
	{ id: 'link', label: 'Chainlink (LINK)', payload: 'binance::LINKUSDT::Chainlink / USDT' },
	{ id: 'bnb', label: 'BNB', payload: 'binance::BNBUSDT::BNB / USDT' },
] as const;

export function getDemoDatasetById(id: string): DemoDataset | undefined {
	return DEMO_DATASETS.find((d) => d.id === id);
}
