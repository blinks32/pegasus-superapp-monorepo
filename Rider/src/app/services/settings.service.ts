import { Injectable, OnDestroy } from '@angular/core';
import { Firestore, doc, onSnapshot, DocumentReference, getDoc } from '@angular/fire/firestore';
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
  settings$: Observable<AppSettings> = this.settingsSubject.asObservable();

  // Current values (synchronous access)
  get currency(): string {
    return this.settingsSubject.value.currency;
  }

  get currencySymbol(): string {
    return this.settingsSubject.value.currencySymbol;
  }

  get settings(): AppSettings {
    return this.settingsSubject.value;
  }

  constructor(private firestore: Firestore) {
    this.initSettingsListener();
  }

  /**
   * Initialize real-time listener for Settings/general document
   */
  private initSettingsListener(): void {
    try {
      const settingsRef = doc(this.firestore, 'Settings', 'general') as DocumentReference;
      
      this.unsubscribe = onSnapshot(
        settingsRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            const settings: AppSettings = {
              currency: data['currency'] || DEFAULT_SETTINGS.currency,
              currencySymbol: data['currencySymbol'] || DEFAULT_SETTINGS.currencySymbol
            };
            console.log('Settings updated:', settings);
            this.settingsSubject.next(settings);
          } else {
            // Document doesn't exist, use defaults
            console.log('Settings document not found, using defaults');
            this.settingsSubject.next(DEFAULT_SETTINGS);
          }
        },
        (error) => {
          console.error('Error listening to settings:', error);
          // Keep using current/default values on error
        }
      );
    } catch (error) {
      console.error('Error initializing settings listener:', error);
    }
  }

  /**
   * Format a price with the current currency symbol
   * @param price The price value to format
   * @param decimals Number of decimal places (default: 2)
   * @returns Formatted price string with currency symbol
   */
  formatPrice(price: number | string, decimals: number = 2): string {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) {
      return `${this.currencySymbol}0.00`;
    }
    return `${this.currencySymbol}${numPrice.toFixed(decimals)}`;
  }

  /**
   * Format a price range with the current currency symbol
   * @param min Minimum price
   * @param max Maximum price
   * @param decimals Number of decimal places (default: 0)
   * @returns Formatted price range string
   */
  formatPriceRange(min: number, max: number, decimals: number = 0): string {
    return `${this.currencySymbol}${min.toFixed(decimals)} - ${this.currencySymbol}${max.toFixed(decimals)}`;
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
