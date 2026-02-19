import { Injectable } from '@angular/core';
import { Firestore, doc, docData, updateDoc, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

export interface AppSettings {
  currency: string;
  currencySymbol: string;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settings$: Observable<AppSettings>;

  constructor(private firestore: Firestore) {
    const settingsDoc = doc(this.firestore, 'Settings/general');
    this.settings$ = docData(settingsDoc).pipe(
      map(data => {
        if (!data) {
          return { currency: 'USD', currencySymbol: '$' } as AppSettings;
        }
        return data as AppSettings;
      }),
      catchError(err => {
        console.warn('Settings read failed (likely permission denied):', err);
        return of({ currency: 'USD', currencySymbol: '$' } as AppSettings);
      }),
      shareReplay(1)
    );
  }

  getSettings(): Observable<AppSettings> {
    return this.settings$;
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    const settingsDoc = doc(this.firestore, 'Settings/general');
    // Use setDoc with merge: true to create if not exists or update
    await setDoc(settingsDoc, settings, { merge: true });
  }
}
