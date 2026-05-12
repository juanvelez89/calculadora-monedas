import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Currency, RateCache, RateResponse } from '../models/currency.model';

const BASE_URL = 'https://api.frankfurter.dev/v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const CACHE_KEY_PREFIX = 'fx_rate_';
const CURRENCIES_CACHE_KEY = 'fx_currencies';

// Monedas prioritarias para Latinoamerica
export const PRIORITY_CURRENCIES = [
  'USD', 'EUR', 'MXN', 'COP', 'ARS', 'BRL',
  'CLP', 'PEN', 'UYU', 'GBP', 'CAD', 'JPY', 'CNY'
];

interface FrankfurterCurrency {
  iso_code: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {

  constructor(private http: HttpClient) {}

  getCurrencies(): Observable<Currency[]> {
    const cached = localStorage.getItem(CURRENCIES_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Currency[];
        // Validar que el cache tiene el formato correcto (code debe ser string de letras)
        if (parsed.length > 0 && typeof parsed[0].code === 'string' && /^[A-Z]/.test(parsed[0].code)) {
          return of(parsed);
        }
      } catch {}
      // Cache corrupto: borrarlo y refetchar
      localStorage.removeItem(CURRENCIES_CACHE_KEY);
    }

    return this.http.get<FrankfurterCurrency[]>(`${BASE_URL}/currencies`).pipe(
      map(data => {
        const all: Currency[] = data.map(c => ({ code: c.iso_code, name: c.name }));
        // Ordenar: primero las prioritarias, luego el resto alfabeticamente
        const priority = PRIORITY_CURRENCIES
          .map(code => all.find(c => c.code === code))
          .filter((c): c is Currency => !!c);
        const rest = all
          .filter(c => !PRIORITY_CURRENCIES.includes(c.code))
          .sort((a, b) => a.code.localeCompare(b.code));
        const sorted = [...priority, ...rest];
        localStorage.setItem(CURRENCIES_CACHE_KEY, JSON.stringify(sorted));
        return sorted;
      }),
      catchError(() => {
        // Fallback: lista minima si no hay red ni cache
        return of(PRIORITY_CURRENCIES.map(code => ({ code, name: code })));
      })
    );
  }

  getRate(base: string, quote: string): Observable<{ rate: number; date: string; fromCache: boolean }> {
    const cacheKey = `${CACHE_KEY_PREFIX}${base}_${quote}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const entry: RateCache & { date: string } = JSON.parse(cached);
      const age = Date.now() - new Date(entry.fetchedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return of({ rate: entry.rate, date: entry.date || entry.fetchedAt, fromCache: false });
      }
    }

    return this.http.get<{ rate: number; date: string }>(`${BASE_URL}/rate/${base}/${quote}`).pipe(
      tap(data => {
        const entry = { base, quote, rate: data.rate, date: data.date, fetchedAt: new Date().toISOString() };
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      }),
      map(data => ({ rate: data.rate, date: data.date, fromCache: false })),
      catchError(() => {
        if (cached) {
          const entry: RateCache & { date: string } = JSON.parse(cached);
          return of({ rate: entry.rate, date: entry.date || entry.fetchedAt, fromCache: true });
        }
        return throwError(() => new Error('Sin conexion y sin datos en cache para este par'));
      })
    );
  }
}
