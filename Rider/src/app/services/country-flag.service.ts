import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CountryFlagService {

  // Map of country codes to flag emojis as fallback
  private flagEmojis: { [key: string]: string } = {
    'MY': '🇲🇾',
    'US': '🇺🇸',
    'SA': '🇸🇦',
    'AE': '🇦🇪',
    'IN': '🇮🇳',
    'PK': '🇵🇰',
    'BD': '🇧🇩',
    'SG': '🇸🇬',
    'TH': '🇹🇭',
    'ID': '🇮🇩',
    'PH': '🇵🇭',
    'VN': '🇻🇳',
    'GB': '🇬🇧',
    'AU': '🇦🇺',
    'CA': '🇨🇦',
    'DE': '🇩🇪',
    'FR': '🇫🇷',
    'IT': '🇮🇹',
    'ES': '🇪🇸',
    'NL': '🇳🇱',
    'BE': '🇧🇪',
    'CH': '🇨🇭',
    'AT': '🇦🇹',
    'SE': '🇸🇪',
    'NO': '🇳🇴',
    'DK': '🇩🇰',
    'FI': '🇫🇮',
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'CN': '🇨🇳',
    'HK': '🇭🇰',
    'TW': '🇹🇼',
    'BR': '🇧🇷',
    'MX': '🇲🇽',
    'AR': '🇦🇷',
    'CL': '🇨🇱',
    'CO': '🇨🇴',
    'PE': '🇵🇪',
    'ZA': '🇿🇦',
    'EG': '🇪🇬',
    'NG': '🇳🇬',
    'KE': '🇰🇪',
    'GH': '🇬🇭',
    'RU': '🇷🇺',
    'TR': '🇹🇷',
    'IL': '🇮🇱',
    'JO': '🇯🇴',
    'LB': '🇱🇧',
    'KW': '🇰🇼',
    'QA': '🇶🇦',
    'BH': '🇧🇭',
    'OM': '🇴🇲',
    'IQ': '🇮🇶',
    'IR': '🇮🇷',
    'AF': '🇦🇫',
    'LK': '🇱🇰',
    'NP': '🇳🇵',
    'BT': '🇧🇹',
    'MM': '🇲🇲',
    'KH': '🇰🇭',
    'LA': '🇱🇦',
    'BN': '🇧🇳',
    'MV': '🇲🇻'
  };

  constructor() { }

  /**
   * Get flag for country code - tries CDN first, falls back to emoji
   */
  getFlagUrl(countryCode: string): string {
    const code = countryCode.toUpperCase();
    
    // Try CDN first (might work on some devices/networks)
    const cdnUrl = `https://cdn.kcak11.com/CountryFlags/countries/${code.toLowerCase()}.svg`;
    
    // Return CDN URL - if it fails to load, the img tag can handle fallback
    return cdnUrl;
  }

  /**
   * Get flag emoji as fallback
   */
  getFlagEmoji(countryCode: string): string {
    const code = countryCode.toUpperCase();
    return this.flagEmojis[code] || '🏳️';
  }

  /**
   * Get flag with fallback handling
   */
  getFlagWithFallback(countryCode: string): { url: string, emoji: string } {
    return {
      url: this.getFlagUrl(countryCode),
      emoji: this.getFlagEmoji(countryCode)
    };
  }

  /**
   * Check if CDN is accessible (for testing)
   */
  async testCdnAccess(): Promise<boolean> {
    try {
      // Try to access the CDN with a simple HEAD request
      const response = await fetch('https://cdn.kcak11.com/CountryFlags/countries/my.svg', {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      console.log('CDN not accessible, will use emoji fallbacks');
      return false;
    }
  }
}