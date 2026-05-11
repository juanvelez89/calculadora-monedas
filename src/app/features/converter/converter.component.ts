import {
  Component, OnInit, OnDestroy, signal, computed, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { Currency } from '../../core/models/currency.model';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'app-converter',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './converter.component.html',
  styleUrls: ['./converter.component.scss']
})
export class ConverterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currencies = signal<Currency[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  rateDate = signal<string | null>(null);
  fromCache = signal(false);

  currentRate = signal<number | null>(null);
  result = signal<number | null>(null);

  amountControl = new FormControl<number | null>(null);
  fromSearchControl = new FormControl('');
  toSearchControl = new FormControl('');

  selectedFrom = signal<Currency | null>(null);
  selectedTo = signal<Currency | null>(null);

  filteredFrom = signal<Currency[]>([]);
  filteredTo = signal<Currency[]>([]);

  isFavorite = computed(() => {
    const from = this.selectedFrom();
    const to = this.selectedTo();
    if (!from || !to) return false;
    return this.storage.isFavorite(from.code, to.code);
  });

  history = computed(() => this.storage.history());
  favorites = computed(() => this.storage.favorites());

  constructor(
    private rateService: ExchangeRateService,
    public storage: StorageService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.rateService.getCurrencies().subscribe(list => {
      this.currencies.set(list);
      this.filteredFrom.set(list);
      this.filteredTo.set(list);

      // Defaults: USD → moneda local o COP
      const userLocale = navigator.language;
      const defaultTo = this.guessLocaleCurrency(userLocale) ?? 'COP';
      this.selectCurrency('from', list.find(c => c.code === 'USD') ?? list[0]);
      this.selectCurrency('to', list.find(c => c.code === defaultTo) ?? list[1]);
    });

    this.fromSearchControl.valueChanges.pipe(
      debounceTime(150), takeUntil(this.destroy$)
    ).subscribe(q => this.filteredFrom.set(this.filterCurrencies(q ?? '')));

    this.toSearchControl.valueChanges.pipe(
      debounceTime(150), takeUntil(this.destroy$)
    ).subscribe(q => this.filteredTo.set(this.filterCurrencies(q ?? '')));

    this.amountControl.valueChanges.pipe(
      debounceTime(200), takeUntil(this.destroy$)
    ).subscribe(() => this.recalculate());
  }

  private guessLocaleCurrency(locale: string): string | null {
    const map: Record<string, string> = {
      'es-MX': 'MXN', 'es-CO': 'COP', 'es-AR': 'ARS',
      'es-CL': 'CLP', 'es-PE': 'PEN', 'es-UY': 'UYU',
      'pt-BR': 'BRL', 'en-US': 'USD', 'en-GB': 'GBP',
    };
    return map[locale] ?? map[locale.split('-')[0]] ?? null;
  }

  private filterCurrencies(query: string): Currency[] {
    const q = query.toLowerCase();
    if (!q) return this.currencies();
    return this.currencies().filter(
      c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }

  selectCurrency(side: 'from' | 'to', currency: Currency): void {
    if (side === 'from') {
      this.selectedFrom.set(currency);
      this.fromSearchControl.setValue(currency.code, { emitEvent: false });
    } else {
      this.selectedTo.set(currency);
      this.toSearchControl.setValue(currency.code, { emitEvent: false });
    }
    this.fetchRate();
  }

  swap(): void {
    const from = this.selectedFrom();
    const to = this.selectedTo();
    if (!from || !to) return;
    this.selectedFrom.set(to);
    this.selectedTo.set(from);
    this.fromSearchControl.setValue(to.code, { emitEvent: false });
    this.toSearchControl.setValue(from.code, { emitEvent: false });
    this.fetchRate();
  }

  fetchRate(): void {
    const from = this.selectedFrom();
    const to = this.selectedTo();
    if (!from || !to || from.code === to.code) return;

    this.loading.set(true);
    this.error.set(null);

    this.rateService.getRate(from.code, to.code).subscribe({
      next: ({ rate, date, fromCache }) => {
        this.currentRate.set(rate);
        this.rateDate.set(date);
        this.fromCache.set(fromCache);
        this.loading.set(false);
        this.recalculate();

        if (fromCache) {
          this.snackBar.open(
            `Sin conexion. Usando tasa del ${date}.`,
            'OK', { duration: 5000, panelClass: 'snack-warn' }
          );
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.message ?? 'Error al obtener la tasa de cambio');
      }
    });
  }

  recalculate(): void {
    const amount = this.amountControl.value;
    const rate = this.currentRate();
    if (amount != null && amount > 0 && rate != null) {
      const res = amount * rate;
      this.result.set(res);
      this.saveToHistory(amount, res, rate);
    } else {
      this.result.set(null);
    }
  }

  private saveToHistory(amount: number, result: number, rate: number): void {
    const from = this.selectedFrom();
    const to = this.selectedTo();
    if (!from || !to) return;

    this.storage.addToHistory({
      from: from.code,
      to: to.code,
      amount,
      result,
      rate,
      date: new Date().toISOString()
    });
  }

  applyHistory(index: number): void {
    const record = this.history()[index];
    if (!record) return;
    const currencies = this.currencies();
    const from = currencies.find(c => c.code === record.from);
    const to = currencies.find(c => c.code === record.to);
    if (from) this.selectCurrency('from', from);
    if (to) this.selectCurrency('to', to);
    this.amountControl.setValue(record.amount);
  }

  applyFavorite(pair: { from: string; to: string }): void {
    const currencies = this.currencies();
    const from = currencies.find(c => c.code === pair.from);
    const to = currencies.find(c => c.code === pair.to);
    if (from) this.selectCurrency('from', from);
    if (to) this.selectCurrency('to', to);
  }

  toggleFavorite(): void {
    const from = this.selectedFrom();
    const to = this.selectedTo();
    if (!from || !to) return;
    const fav = this.storage.isFavorite(from.code, to.code);
    this.storage.toggleFavorite({ from: from.code, to: to.code });
    if (!fav) {
      this.snackBar.open(`${from.code}/${to.code} agregado a favoritos`, '', { duration: 2000 });
    }
  }

  displayCurrency(currency: Currency): string {
    return currency ? currency.code : '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
