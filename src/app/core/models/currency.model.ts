export interface Currency {
  code: string;
  name: string;
}

export interface RateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface ConversionRecord {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  date: string;
}

export interface RateCache {
  base: string;
  quote: string;
  rate: number;
  fetchedAt: string;
}

export interface FavoritePair {
  from: string;
  to: string;
}
