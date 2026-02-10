import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

@Injectable({
  providedIn: 'root'
})
export class PlatformService {

  constructor() { }

  /**
   * Check if running on a native platform (iOS/Android)
   */
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Check if running on web platform
   */
  isWeb(): boolean {
    return Capacitor.getPlatform() === 'web';
  }

  /**
   * Safely set StatusBar overlay
   */
  async setStatusBarOverlay(overlay: boolean): Promise<void> {
    if (this.isNative()) {
      await StatusBar.setOverlaysWebView({ overlay });
    }
  }

  /**
   * Safely hide splash screen
   */
  async hideSplashScreen(): Promise<void> {
    if (this.isNative()) {
      await SplashScreen.hide();
    }
  }

  /**
   * Get current platform name
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  }
}