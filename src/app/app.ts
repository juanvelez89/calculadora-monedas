import { Component } from '@angular/core';
import { ConverterComponent } from './features/converter/converter.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ConverterComponent],
  template: `<app-converter></app-converter>`,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f5f5f5;
      padding: 24px 16px;
    }
  `]
})
export class App {}
