import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LanguageOption {
  code: string;
  label: string;
  isoCode: string;
  flag: string;
}

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  languageChange = new Subject<string>();
  private currentLang: string = 'en';
  private readonly preferredKey = 'preferred_language';
  private readonly legacyKey = 'language';
  private availableLanguages: LanguageOption[];

  constructor(private translate: TranslateService) {
    this.availableLanguages = this.buildLanguageOptions();

    // Initialize with stored language or default
    const storedLang =
      localStorage.getItem(this.preferredKey) ||
      localStorage.getItem(this.legacyKey) ||
      'en';
    this.setLanguage(storedLang);
  }

  setLanguage(lang: string) {
    this.currentLang = lang;
    this.translate.use(lang);
    localStorage.setItem(this.preferredKey, lang);
    localStorage.setItem(this.legacyKey, lang);
    this.languageChange.next(lang);
    document.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  getLanguage(): string {
    return this.currentLang;
  }

  getAvailableLanguages(): LanguageOption[] {
    return this.availableLanguages;
  }

  private buildLanguageOptions(): LanguageOption[] {
    const configs: Omit<LanguageOption, 'flag'>[] = [
      { code: 'en', label: 'English', isoCode: 'US' },
      { code: 'ar', label: 'العربية', isoCode: 'AE' },
      { code: 'ms', label: 'Bahasa Melayu', isoCode: 'MY' }
    ];

    return configs.map(config => ({
      ...config,
      flag: this.getFlagByIso(config.isoCode) || 'assets/icon/flag.png'
    }));
  }

  private getFlagByIso(isoCode: string): string | null {
    const match = environment.CountryJson.find(
      country => country.isoCode.toLowerCase() === isoCode.toLowerCase()
    );
    return match?.flag || null;
  }
} 