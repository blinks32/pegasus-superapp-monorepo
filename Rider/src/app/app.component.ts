import { Component, NgZone } from '@angular/core';
import { NavController, Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { AvatarService } from './services/avatar.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Auth } from '@angular/fire/auth';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Preferences } from '@capacitor/preferences';
import { OnesignalService } from './services/one-signal.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  currentLanguage: string;
  user: any;
  source: string;
  loading: boolean = true;

  appPages = [
    { title: 'MENU.HISTORY', url: '/history', icon: 'time', color: 'primary' },
    { title: 'MENU.PAYMENT', url: '/payment', icon: 'card', color: 'primary' },
    { title: 'MENU.PROMOTION', url: '/promotion', icon: 'gift', color: 'primary' },
    { title: 'MENU.SUPPORT', url: '/support', icon: 'chatbubbles', color: 'primary' },
    { title: 'MENU.ABOUT', url: '/about', icon: 'information-circle', color: 'primary' },
  ];

  constructor(
    private platform: Platform,
    private ngZone: NgZone,
    public avatar: AvatarService,
    private auth: Auth,
    private nav: NavController,
    private router: Router,
    private translate: TranslateService,
    private oneSignalService: OnesignalService
  ) {
    this.initializeApp();
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        console.log('Navigation ended:', event);
      }
    });
  }

  initializeApp() {
    // Set default language
    this.currentLanguage = this.translate.getDefaultLang() || 'en';
    this.initializeTranslation();
    this.initialize();
    this.setupNotificationHandler();
  }

  /**
   * Set up notification click handler for shared ride deep links
   * Uses the existing OnesignalService
   */
  private setupNotificationHandler(): void {
    // Notification handling is done via OnesignalService
    // The service already sets up click listeners in OneSignalInit()
    // Deep link handling for shared rides is managed in home.page.ts via query params
    console.log('Notification handler delegated to OnesignalService');
  }

  async initialize() {
    this.platform.ready().then(async (readySource: string) => {
      this.source = readySource;
      this.auth.onAuthStateChanged(async (user) => {
        this.user = user;
        console.log('Auth state changed:', user);

        if (user) {
          // User is signed in
          console.log('User is signed in:', user);
        } else {
          // User is signed out
          console.log('User is signed out');
        }

        if (readySource != 'dom') {
          await StatusBar.setBackgroundColor({ color: '#3880ff' });
          StatusBar.setStyle({ style: Style.Light });
        }
        await this.LoadSplash();
        this.loading = false;
      });
    });
  }

  async LoadSplash() {
    await SplashScreen.show();

    if (this.source != 'dom')
      await StatusBar.setOverlaysWebView({ overlay: true });
  }

  gotoProfile() {
    this.nav.navigateForward('profile');
  }

  gotoPage(p) {
    this.nav.navigateForward(p);
  }

  async initializeTranslation() {
    this.translate.setDefaultLang('en'); // Set English as default

    try {
      const { value } = await Preferences.get({ key: 'user-lang' });
      const lang = value || 'en'; // Default to English
      this.translate.use(lang);
      this.currentLanguage = lang;
    } catch (error) {
      console.error('Error loading language preference:', error);
      this.translate.use('en');
      this.currentLanguage = 'en';
    }
  }

  async changeLanguage(lang: string) {
    this.currentLanguage = lang;
    this.translate.use(lang);
    await Preferences.set({ key: 'user-lang', value: lang });
  }
}
