import { Injectable, OnDestroy } from '@angular/core';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AppSettings {
  currency: string;
  currencySymbol: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'USD',
  currencySymbol: '$'
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService implements OnDestroy {
  private settingsSubject = new BehaviorSubject<AppSettings>(DEFAULT_SETTINGS);
  private unsubscribe: (() => void) | null = null;

  // Observable for components to subscribe to
  public settings$: Observable<AppSettings> = this.settingsSubject.asObservable();

  // Convenience getters for synchronous access
  get currency(): string {
    return this.settingsSubject.value.currency;
  }

  get currencySymbol(): string {
    return this.settingsSubject.value.currencySymbol;
  }

  get currentSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  constructor(private firestore: Firestore) {
    this.subscribeToSettings();
  }

  private subscribeToSettings(): void {
    try {
      const settingsRef = doc(this.firestore, 'Settings', 'general');
      
      this.unsubscribe = onSnapshot(settingsRef, 
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const settings: AppSettings = {
              currency: data['currency'] || DEFAULT_SETTINGS.currency,
              currencySymbol: data['currencySymbol'] || DEFAULT_SETTINGS.currencySymbol
            };
            this.settingsSubject.next(settings);
            console.log('Settings loaded:', settings);
          } else {
            // Document doesn't exist, use defaults
            console.log('Settings document not found, using defaults');
            this.settingsSubject.next(DEFAULT_SETTINGS);
          }
        },
        (error) => {
          console.error('Error fetching settings:', error);
          // Keep using current/default settings on error
        }
      );
    } catch (error) {
      console.error('Error setting up settings listener:', error);
    }
  }

  /**
   * Format a price with the dynamic currency symbol
   * @param price - The numeric price to format
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted price string with currency symbol
   */
  formatPrice(price: number | string, decimals: number = 2): string {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) {
      return `${this.currencySymbol}0.00`;
    }
    return `${this.currencySymbol}${numPrice.toFixed(decimals)}`;
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
