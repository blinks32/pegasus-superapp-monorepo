import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, ModalController, ModalOptions, NavController, Platform } from '@ionic/angular';
import { OtpComponent } from '../otp/otp.component';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { OverlayService } from '../services/overlay.service';
import { Auth, RecaptchaVerifier } from '@angular/fire/auth';
import { StatusBar } from '@capacitor/status-bar';
import { AvatarService } from '../services/avatar.service';
import { SplashScreen } from '@capacitor/splash-screen';
import { CountrySearchModalComponent } from '../country-search-modal/country-search-modal.component';
import { TranslateService } from '@ngx-translate/core';
//import { LanguageOption, LanguageService } from '../services/language.service';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  form: FormGroup;
  isInTestMode: boolean = false; // Flag to track if we're in test mode
  CountryCode: any = '+60';
  CountryJson = environment.CountryJson;
  flag: any = "https://cdn.kcak11.com/CountryFlags/countries/my.svg";
  filteredCountries = [];
  user: any;
  approve: boolean;
  approve2: boolean = false;
  isNavigating: boolean = false; // Flag to prevent multiple navigations
  recaptchaVerifier: RecaptchaVerifier;
  //languageOptions: LanguageOption[] = [];
  currentLanguage = 'en';
  defaultLoginConfig = (environment as any).defaultLogin; // Default login configuration

  slideOpts = {
    initialSlide: 0,
    speed: 300,
    autoplay: true
  };

  numberT: string = '+60';
  backButtonSubscription: any;

  constructor(
    private modalCtrl: ModalController,
    private auth: AuthService,
    private router: Router,
    private nav: NavController,
    private authY: Auth,
    private avatar: AvatarService,
    private overlay: OverlayService,
    private alertController: AlertController,
    private platform: Platform,
    private translate: TranslateService,
    //private languageService: LanguageService
  ) {
    this.setDefaultCountry();
    this.detectUserCountry();
    //this.languageOptions = this.languageService.getAvailableLanguages();
    //this.currentLanguage = this.languageService.getLanguage();
  }

  async ngOnInit() {
    this.form = new FormGroup({
      phone: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(10), Validators.maxLength(10)]
      }),
    });

    this.filteredCountries = this.CountryJson;

    // Apply default login credentials if enabled
    this.applyDefaultLogin();

    // Initialize ReCaptcha verifier only for web platform
    if (typeof window !== 'undefined' && window.document && !window['Capacitor']) {
      this.recaptchaVerifier = new RecaptchaVerifier(this.authY, 'sign-in-button', {
        'size': 'invisible',
        'callback': (response) => {
          // reCAPTCHA solved - allow signIn
          this.signIn();
        },
        'expired-callback': () => {
          // Response expired - handle expired reCAPTCHA
        }
      });
    }
    await this.loadLanguage();

    this.initializeBackButtonCustomHandler(); // Initialize back button handler

    // Add global auth state listener for the login page
    this.authY.onAuthStateChanged(async (user) => {
      if (user) {
        console.log('User detected by global observer in LoginPage');
        await this.handleUserNavigation(user);
      }
    });
  }

  /**
   * Apply default login credentials from environment config
   */
  applyDefaultLogin() {
    if (this.defaultLoginConfig?.enabled) {
      console.log('🔐 Test Mode enabled - auto-filling credentials');

      // Set country code
      if (this.defaultLoginConfig.countryCode) {
        this.CountryCode = this.defaultLoginConfig.countryCode;
        this.numberT = this.defaultLoginConfig.countryCode;

        // Find and update flag for the country
        const country = this.CountryJson.find(c => c.dialCode === this.defaultLoginConfig.countryCode);
        if (country) {
          this.flag = country.flag;
        }
      }

      // Set phone number
      if (this.defaultLoginConfig.phoneNumber) {
        this.form.controls['phone'].setValue(this.defaultLoginConfig.phoneNumber);
      }

      // Store OTP for auto-fill in OTP modal
      if (this.defaultLoginConfig.otp) {
        localStorage.setItem('defaultOTP', this.defaultLoginConfig.otp);
      }

      // Set test mode flag for seamless login
      this.isInTestMode = true;
    }
  }

  async HideSplash() {
    await SplashScreen.hide();
  }

  async openCountrySearchModal() {
    const modal = await this.modalCtrl.create({
      component: CountrySearchModalComponent
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data) {
      this.CountryCode = data.dialCode;
      this.numberT = data.dialCode;
    }
  }

  filterCountries(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    this.filteredCountries = this.CountryJson.filter(country =>
      country.name.toLowerCase().includes(searchTerm) ||
      country.dialCode.includes(searchTerm)
    );
  }

  countryCodeChange($event) {
    this.CountryCode = '';
    this.numberT = $event.detail.value.toString();
  }

  async Show() {
    await StatusBar.setOverlaysWebView({ overlay: false });
  }

  async Hide() {
    await StatusBar.setOverlaysWebView({ overlay: true });
  }

  async signInWithGoogle() {
    try {
      this.overlay.showLoader('');

      const result = await this.auth.signInWithGoogle();
      const user = result.user;

      if (user) {
        await this.handleUserNavigation(user);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.overlay.hideLoader();

      let errorMessage = await this.translate.get('GOOGLE_SIGNIN_ERROR').toPromise();
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = await this.translate.get('SIGNIN_CANCELLED').toPromise();
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = await this.translate.get('NETWORK_ERROR').toPromise();
      } else if (error.code === 'auth/unauthorized-domain') {
        const title = await this.translate.get('UNAUTHORIZED_DOMAIN_TITLE').toPromise();
        const detail = await this.translate.get('UNAUTHORIZED_DOMAIN_DETAIL').toPromise();
        const cause = await this.translate.get('UNAUTHORIZED_DOMAIN_CAUSE').toPromise();
        await this.overlay.showAlert(title, `${detail}\n\n${cause}`);
        return;
      }

      this.overlay.showAlert(
        await this.translate.get('ERROR').toPromise(),
        errorMessage || 'Failed to sign in with Google'
      );
    }
  }

  async signIn() {
    try {
      if (!this.form.valid) {
        this.form.markAllAsTouched();
        return;
      }

      this.overlay.showLoader('');
      const fullPhoneNumber = this.numberT + this.form.value.phone;

      let confirmationResult;

      // Check if we're in test mode - bypass Firebase
      if (this.isInTestMode) {
        console.log('🧪 Test mode active - bypassing Firebase');
        this.overlay.hideLoader();
        const testOTP = localStorage.getItem('defaultOTP') || '123456';
        return this.proceedWithTestMode(this.form.value.phone, testOTP);
      }

      try {
        confirmationResult = await this.auth.signInWithPhoneNumber(fullPhoneNumber);
      } catch (authError) {
        console.error('Firebase authentication error:', authError);
        this.overlay.hideLoader();
        await this.handleAuthError(authError);
        return;
      }

      let storedOTP = localStorage.getItem('defaultOTP') || '';
      this.overlay.hideLoader();

      const options: ModalOptions = {
        component: OtpComponent,
        componentProps: {
          defaultOtp: storedOTP,
          phone: this.form.value.phone,
          countryCode: this.numberT,
          confirmationResult: confirmationResult,
          isTestMode: false
        },
      };

      const modal = await this.modalCtrl.create(options);
      await modal.present();
    } catch (e) {
      console.error('Error during signIn:', e);
      this.overlay.hideLoader();
      this.approve2 = false;
      await this.handleAuthError(e);
    }
  }

  async proceedWithTestMode(phoneNumber: string, testOTP: string) {
    // Use the correct test phone number
    const testPhoneNumber = this.defaultLoginConfig?.phoneNumber || phoneNumber;

    // Create a PURE MOCK confirmation result - NO FIREBASE CALLS
    const mockConfirmationResult = {
      confirm: async (otp: string) => {
        console.log('🧪 Test mode: Verifying OTP:', otp);
        if (otp === testOTP) {
          console.log('✅ Test mode: OTP verified successfully');
          try {
            this.overlay.showLoader('Signing in...');
            const fullPhoneNumber = this.numberT + testPhoneNumber;

            // This is the ONLY Firebase call in test mode - when OTP is verified
            // We ensure reCAPTCHA is cleared before this to avoid "already rendered" error
            this.auth.clearRecaptcha();

            const realConfirmationResult = await this.auth.signInWithPhoneNumber(fullPhoneNumber);
            const result = await realConfirmationResult.confirm(otp);
            this.overlay.hideLoader();
            console.log('✅ Test mode: Firebase authentication completed');
            return result;
          } catch (error) {
            this.overlay.hideLoader();
            console.error('❌ Test mode: Firebase authentication failed:', error);
            throw error;
          }
        } else {
          throw new Error('Invalid OTP');
        }
      }
    };

    // Open OTP modal with test credentials pre-filled
    const modal = await this.modalCtrl.create({
      component: OtpComponent,
      componentProps: {
        defaultOtp: testOTP,
        phone: testPhoneNumber,
        countryCode: this.numberT,
        confirmationResult: mockConfirmationResult,
        isTestMode: true
      },
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
  }

  /**
   * Centralized navigation logic after authentication
   */
  private async handleUserNavigation(user: any) {
    if (this.isNavigating) return;
    this.isNavigating = true;

    try {
      this.overlay.showLoader('');

      // Check if driver document exists in database
      const driverData = await this.avatar.checkDriverExistsByUid(user.uid);

      this.overlay.hideLoader();

      if (driverData) {
        console.log('Existing driver found, navigating to tabs');
        this.router.navigateByUrl('tabs');
      } else {
        console.log('No driver document found, navigating to details');
        this.router.navigateByUrl('details');
      }
    } catch (error) {
      console.error('Error checking driver document:', error);
      this.overlay.hideLoader();
      // On error, go to details page as fallback
      this.router.navigateByUrl('details');
    } finally {
      this.isNavigating = false;
      this.approve2 = false;
    }
  }

  async handleAuthError(error: any) {
    let errorTitle = await this.translate.get('ERROR').toPromise();
    let errorMessage = '';
    let errorDetails = '';

    switch (error.code) {
      case 'auth/invalid-phone-number':
        errorMessage = await this.translate.get('MOBILE_INVALID').toPromise();
        break;

      case 'auth/too-many-requests':
        errorTitle = await this.translate.get('TOO_MANY_REQUESTS_TITLE').toPromise() || '⚠️ Too Many Attempts';
        errorMessage = 'Too many authentication attempts. Please wait 15-30 minutes and try again.';
        break;

      case 'auth/operation-not-allowed':
        errorTitle = await this.translate.get('REGION_NOT_ALLOWED_TITLE').toPromise();
        errorMessage = await this.translate.get('REGION_NOT_ALLOWED_DETAIL').toPromise();
        errorDetails = await this.translate.get('REGION_NOT_ALLOWED_CAUSE').toPromise();
        break;

      case 'auth/unauthorized-domain':
        errorTitle = await this.translate.get('UNAUTHORIZED_DOMAIN_TITLE').toPromise();
        errorMessage = await this.translate.get('UNAUTHORIZED_DOMAIN_DETAIL').toPromise();
        errorDetails = await this.translate.get('UNAUTHORIZED_DOMAIN_CAUSE').toPromise();
        break;

      case 'auth/invalid-app-credential':
      case 'auth/quota-exceeded':
        errorTitle = await this.translate.get('SMS_QUOTA_TITLE').toPromise() || '💳 SMS Quota Exceeded';
        errorMessage = 'The daily SMS quota has been reached.';
        break;

      default:
        errorMessage = `${await this.translate.get('SIGN_IN_ERROR').toPromise() || 'Error during sign-in:'} ${error.code || error.message || 'Unknown error'}`;
        break;
    }

    const fullMessage = errorDetails ? `${errorMessage}\n\n${errorDetails}` : errorMessage;
    await this.overlay.showAlert(errorTitle, fullMessage);
  }

  initializeBackButtonCustomHandler() {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton();
    });
  }

  async handleBackButton() {
    try {
      await this.showExitConfirmation();
    } catch (error) {
      console.error('Error handling back button:', error);
    }
  }

  async showExitConfirmation() {
    const alert = await this.alertController.create({
      header: await this.translate.get('EXIT_APP').toPromise(),
      message: await this.translate.get('EXIT_CONFIRM').toPromise(),
      buttons: [
        {
          text: await this.translate.get('CANCEL').toPromise(),
          role: 'cancel'
        },
        {
          text: await this.translate.get('EXIT').toPromise(),
          handler: () => {
            navigator['app'].exitApp();
          }
        }
      ]
    });
    await alert.present();
  }

  async loadLanguage() {
    try {
      const { value } = await Preferences.get({ key: 'user-lang' });
      const lang = value || 'en';
      console.log('Loading language:', lang);

      // Set default language first
      this.translate.setDefaultLang(lang);

      // Then use it
      await this.translate.use(lang).toPromise();

      console.log('Current language:', this.translate.currentLang);
      console.log('Default language:', this.translate.getDefaultLang());

      // Test if translations are loaded
      const testKey = await this.translate.get('APP_NAME').toPromise();
      console.log('APP_NAME translation:', testKey);

    } catch (error) {
      console.error('Error loading language:', error);
      this.translate.setDefaultLang('en');
      await this.translate.use('en').toPromise();
    }
  }

  async changeLanguage(lang: string) {
    console.log('Changing language to:', lang);
    try {
      // Set the language immediately
      this.translate.setDefaultLang(lang);

      // Use the translation service to switch language and wait for it
      await this.translate.use(lang).toPromise();

      console.log('Language successfully changed to:', lang);
      console.log('Current language:', this.translate.currentLang);

      // Save to preferences
      await Preferences.set({ key: 'user-lang', value: lang });

      // Force reload translations by getting a test key
      const testTranslation = await this.translate.get('APP_NAME').toPromise();
      console.log('Test translation:', testTranslation);

    } catch (error) {
      console.error('Error changing language:', error);
    }
  }

  setDefaultCountry() {
    // Set Malaysia as default
    const malaysia = this.CountryJson.find(c => c.isoCode.toLowerCase() === 'my');
    if (malaysia) {
      this.CountryCode = malaysia.dialCode;
      this.numberT = malaysia.dialCode;
      this.flag = malaysia.flag;
    }
  }

  async detectUserCountry() {
    try {
      // Try multiple APIs for better reliability
      let countryCode = await this.tryCountryDetection();

      if (countryCode) {
        // Find matching country from CountryJson
        const country = this.CountryJson.find(c =>
          c.isoCode.toLowerCase() === countryCode.toLowerCase()
        );

        if (country) {
          this.CountryCode = country.dialCode;
          this.numberT = country.dialCode;
          this.flag = country.flag;
          console.log('Country detected:', country.name, country.dialCode);
        }
      }
    } catch (error) {
      console.error('Error detecting country:', error);
      // Keep the default Malaysia settings - don't override them
      console.log('Using default country: Malaysia (+60)');
    }
  }

  private async tryCountryDetection(): Promise<string | null> {
    const apis = [
      'https://ipapi.co/json/',
      'https://api.ipify.org?format=json', // Fallback API
      'https://httpbin.org/ip' // Another fallback
    ];

    for (const apiUrl of apis) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          // Handle different API response formats
          if (data.country_code) {
            return data.country_code;
          }
          // If we get IP, we could use another service, but for now just return null
        }
      } catch (error) {
        console.log(`Failed to fetch from ${apiUrl}:`, error);
        continue;
      }
    }

    return null;
  }
}
