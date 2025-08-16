export type EnergyPoint = { timestamp: string; exported_kwh: number }
export type PricePoint = { timestamp: string; price_pln_per_kwh: number }
export type RevenuePoint = { timestamp: string; exported_kwh: number; price_pln_per_kwh: number; revenue_pln: number }
