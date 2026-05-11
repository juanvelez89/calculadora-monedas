import { Injectable, signal, computed } from '@angular/core';
import { ConversionRecord, FavoritePair } from '../models/currency.model';

const HISTORY_KEY = 'fx_history';
const FAVORITES_KEY = 'fx_favorites';
const MAX_HISTORY = 10;
const MAX_FAVORITES = 5;

@Injectable({ providedIn: 'root' })
export class StorageService {

  private _history = signal<ConversionRecord[]>(this.loadHistory());
  private _favorites = signal<FavoritePair[]>(this.loadFavorites());

  history = computed(() => this._history());
  favorites = computed(() => this._favorites());

  private loadHistory(): ConversionRecord[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadFavorites(): FavoritePair[] {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  addToHistory(record: ConversionRecord): void {
    const current = this._history();
    const updated = [record, ...current].slice(0, MAX_HISTORY);
    this._history.set(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  toggleFavorite(pair: FavoritePair): void {
    const current = this._favorites();
    const exists = current.some(f => f.from === pair.from && f.to === pair.to);
    let updated: FavoritePair[];

    if (exists) {
      updated = current.filter(f => !(f.from === pair.from && f.to === pair.to));
    } else {
      if (current.length >= MAX_FAVORITES) return;
      updated = [...current, pair];
    }

    this._favorites.set(updated);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  }

  isFavorite(from: string, to: string): boolean {
    return this._favorites().some(f => f.from === from && f.to === to);
  }
}
