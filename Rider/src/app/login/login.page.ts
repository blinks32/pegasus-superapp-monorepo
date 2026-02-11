import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, ModalController, Platform } from '@ionic/angular';
import { OtpComponent } from '../otp/otp.component';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { OverlayService } from '../services/overlay.service';
import { StatusBar } from '@capacitor/status-bar';
import { AvatarService } from '../services/avatar.service';
import { SplashScreen } from '@capacitor/splash-screen';
import { CountrySearchModalComponent } from '../country-search-modal/country-search-modal.component';
import { TranslateService } from '@ngx-translate/core';
import { Preferences } from '@capacitor/preferences';
import { CountryFlagService } from '../services/country-flag.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit, OnDestroy {
  form: FormGroup;
  CountryCode: any;
  CountryJson = environment.CountryJson;
  flag: any = "https://cdn.kcak11.com/CountryFlags/countries/my.svg";
  flagEmoji: string = '🇲🇾';
  flagLoadError: boolean = false;
  filteredCountries = [];
  user: any;
  approve: boolean;
  approve2: boolean;
  userCountry: string = 'MY'; // Default to Malaysia
  isInTestMode: boolean = false; // Flag to track if we're in test mode
  defaultLoginConfig = environment.defaultLogin; // Default login configuration

  passwordForm: FormGroup;
  loginMethod: 'phone' | 'password' = 'phone';
  isPasswordSubmitting = false;
  isGoogleSigningIn = false;


  numberT: string;
  backButtonSubscription: any;

  constructor(
    private modalCtrl: ModalController,
    private auth: AuthService,
    private router: Router,
    private avatar: AvatarService,
    private overlay: OverlayService,
    private alertController: AlertController,
    private platform: Platform,
    private translate: TranslateService,
    private countryFlagService: CountryFlagService
  ) {
    // Set Malaysia as default - no auto-detection
    this.CountryCode = '+60';
    this.numberT = '+60';
    this.updateFlag('MY');
  }

  async ngOnInit() {
    this.form = new FormGroup({
      phone: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(10), Validators.maxLength(10)]
      }),
    });

    this.passwordForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required, Validators.minLength(6)])
    });

    this.filteredCountries = this.CountryJson;

    // Apply default login credentials if enabled
    this.applyDefaultLogin();

    // Load saved language from Preferences
    await this.loadLanguage();

    // Auto-detect user country for phone number code if not in test/default login mode
    if (!this.defaultLoginConfig?.enabled) {
      await this.detectUserCountry();
    }

    // Initialize reCAPTCHA after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.auth.recaptcha();
    }, 500);

    this.initializeBackButtonCustomHandler(); // Initialize back button handler
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
          this.userCountry = country.isoCode;
          this.updateFlag(country.isoCode);
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

  ngOnDestroy() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
    // Clean up reCAPTCHA
    this.auth.clearRecaptcha();
  }

  async loadLanguage() {
    try {
      const { value } = await Preferences.get({ key: 'user-lang' });
      const lang = value || 'ms';
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
      this.translate.setDefaultLang('ms');
      await this.translate.use('ms').toPromise();
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
      console.log('Selected country:', data);
      this.CountryCode = data.dialCode;
      this.numberT = data.dialCode;
      this.userCountry = data.isoCode;
      this.updateFlag(data.isoCode);
    }
  }

  filterCountries(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    this.filteredCountries = this.CountryJson.filter(country =>
      country.name.toLowerCase().includes(searchTerm) ||
      country.dialCode.includes(searchTerm)
    );
  }

  countryCodeChange($event: any) {
    this.CountryCode = '';
    this.numberT = $event.detail.value.toString();
  }

  async Show() {
    await StatusBar.setOverlaysWebView({ overlay: false });
  }

  async Hide() {
    await StatusBar.setOverlaysWebView({ overlay: true });
  }

  onLoginMethodChange(event: CustomEvent) {
    const selectedMethod = event.detail.value as 'phone' | 'password';
    this.loginMethod = selectedMethod;

    if (selectedMethod === 'phone' && this.passwordForm) {
      this.passwordForm.reset();
      this.isPasswordSubmitting = false;
    }
  }

  async signIn() {
    if (this.loginMethod === 'password') {
      return this.signInWithEmailPassword();
    }

    try {
      if (!this.form.valid) {
        const errorMessage = this.form.get('phone').hasError('required')
          ? await this.translate.get('MOBILE_REQUIRED').toPromise()
          : await this.translate.get('MOBILE_INVALID').toPromise();
        this.overlay.showAlert(
          await this.translate.get('ERROR').toPromise(),
          errorMessage
        );
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
        // Reset test mode flag for next attempt
        this.isInTestMode = false;
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

      const modal = await this.modalCtrl.create({
        component: OtpComponent,
        componentProps: {
          defaultOtp: storedOTP,
          phone: this.form.value.phone,
          countryCode: this.numberT,
          confirmationResult: confirmationResult,
          isTestMode: false
        },
        canDismiss: true
      });

      await modal.present();
      const { data } = await modal.onWillDismiss();

      if (!data?.user) return;

      await this.navigateAfterLogin(data.user);

    } catch (e) {
      console.error('Unexpected sign-in error:', e);
      this.overlay.hideLoader();
      await this.handleAuthError(e);
    }
  }

  async signInWithEmailPassword() {
    if (this.isPasswordSubmitting) {
      return;
    }

    if (!this.passwordForm.valid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isPasswordSubmitting = true;
    await this.overlay.showLoader('');

    const email = (this.passwordForm.value.email || '').trim();
    const password = this.passwordForm.value.password;

    try {
      const credential = await this.auth.signInWithEmailAndPassword(email, password);
      const user = credential?.user;

      if (!user) {
        throw { code: 'auth/no-user' };
      }

      await this.navigateAfterLogin(user);
    } catch (error) {
      const header = await this.translate.get('ERROR').toPromise();
      const message = await this.getEmailAuthErrorMessage(error);
      await this.overlay.showAlert(header, message);
    } finally {
      await this.overlay.hideLoader();
      this.isPasswordSubmitting = false;
    }
  }

  async signInWithGoogle() {
    if (this.isGoogleSigningIn) {
      return;
    }

    this.isGoogleSigningIn = true;

    try {
      await this.overlay.showLoader('');
      const result = await this.auth.signInWithGoogle();
      const user = result?.user;

      if (!user) {
        throw new Error('Google sign-in failed');
      }

      console.log('Google sign-in successful:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        photoURL: user.photoURL
      });

      // If Google account has a phone number, use it as default
      if (user.phoneNumber) {
        console.log('User has phone number from Google:', user.phoneNumber);
        // Extract country code and phone number
        const phoneNumber = user.phoneNumber;
        // Try to match with known country codes
        const matchedCountry = this.CountryJson.find(country =>
          phoneNumber.startsWith(country.dialCode)
        );

        if (matchedCountry) {
          this.CountryCode = matchedCountry.dialCode;
          this.numberT = matchedCountry.dialCode;
          this.userCountry = matchedCountry.isoCode;
          this.updateFlag(matchedCountry.isoCode);
          // Set the phone number without the country code
          const localNumber = phoneNumber.replace(matchedCountry.dialCode, '');
          this.form.controls['phone'].setValue(localNumber);
        }
      }

      await this.overlay.hideLoader();
      await this.navigateAfterLogin(user);

    } catch (error) {
      console.error('Google sign-in error:', error);
      await this.overlay.hideLoader();

      let errorMessage = await this.translate.get('GOOGLE_SIGN_IN_ERROR').toPromise();

      if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need to show error
        this.isGoogleSigningIn = false;
        return;
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Another popup was opened, no need to show error
        this.isGoogleSigningIn = false;
        return;
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = await this.translate.get('NETWORK_ERROR').toPromise();
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = await this.translate.get('POPUP_BLOCKED').toPromise();
      } else if (error.code === 'auth/unauthorized-domain') {
        const title = await this.translate.get('UNAUTHORIZED_DOMAIN_TITLE').toPromise();
        const detail = await this.translate.get('UNAUTHORIZED_DOMAIN_DETAIL').toPromise();
        const cause = await this.translate.get('UNAUTHORIZED_DOMAIN_CAUSE').toPromise();
        await this.overlay.showAlert(title, `${detail}\n\n${cause}`);
        return;
      }

      await this.overlay.showAlert(
        await this.translate.get('ERROR').toPromise(),
        errorMessage
      );
    } finally {
      this.isGoogleSigningIn = false;
    }
  }

  async showErrorWithTestModeOption(errorCode: string): Promise<boolean> {
    let errorTitle = '';
    let errorMessage = '';
    let errorDetails = '';

    // Get the specific error information
    switch (errorCode) {
      case 'auth/too-many-requests':
        errorTitle = await this.translate.get('TOO_MANY_REQUESTS_TITLE').toPromise();
        errorMessage = await this.translate.get('TOO_MANY_REQUESTS_DETAIL').toPromise();
        errorDetails = await this.translate.get('TOO_MANY_REQUESTS_CAUSE').toPromise();
        break;
      case 'auth/quota-exceeded':
      case 'auth/invalid-app-credential':
        errorTitle = await this.translate.get('SMS_QUOTA_TITLE').toPromise();
        errorMessage = await this.translate.get('SMS_QUOTA_DETAIL').toPromise();
        errorDetails = await this.translate.get('SMS_QUOTA_CAUSE').toPromise();
        break;
      case 'auth/captcha-check-failed':
        errorTitle = await this.translate.get('CAPTCHA_FAILED_TITLE').toPromise();
        errorMessage = await this.translate.get('CAPTCHA_FAILED_DETAIL').toPromise();
        errorDetails = await this.translate.get('CAPTCHA_FAILED_CAUSE').toPromise();
        break;
      case 'auth/internal-error':
        errorTitle = await this.translate.get('INTERNAL_ERROR_TITLE').toPromise();
        errorMessage = await this.translate.get('INTERNAL_ERROR_DETAIL').toPromise();
        errorDetails = await this.translate.get('INTERNAL_ERROR_CAUSE').toPromise();
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
      default:
        // For unknown errors, show the actual error code
        errorTitle = '❌ Authentication Error';
        errorMessage = `Firebase authentication failed with error code:\n\n${errorCode}`;
        errorDetails = '📋 Possible Causes:\n• Firebase configuration issue\n• Network connectivity problem\n• Service temporarily unavailable\n• Billing or quota limits\n\n💡 You can use Test Mode to continue development.';
    }

    // Combine error with test mode offer
    const fullMessage = errorDetails
      ? `${errorMessage}\n\n${errorDetails}\n\n━━━━━━━━━━━━━━━━━━━━\n\n${await this.translate.get('TEST_MODE_OFFER').toPromise()}`
      : `${errorMessage}\n\n━━━━━━━━━━━━━━━━━━━━\n\n${await this.translate.get('TEST_MODE_OFFER').toPromise()}`;

    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: errorTitle,
        message: fullMessage,
        cssClass: 'error-alert',
        buttons: [
          {
            text: await this.translate.get('CLOSE').toPromise(),
            role: 'cancel',
            cssClass: 'secondary',
            handler: () => {
              console.log('User clicked Close');
              resolve(false);
            }
          },
          {
            text: await this.translate.get('USE_TEST_MODE').toPromise(),
            cssClass: 'primary',
            handler: () => {
              console.log('User clicked Use Test Mode');
              resolve(true);
            }
          }
        ]
      });

      await alert.present();
      console.log('Alert presented');
    });
  }

  async switchToTestMode() {
    // Make sure loader is hidden
    this.overlay.hideLoader();

    // Set test credentials
    this.CountryCode = '+60';
    this.numberT = '+60';
    const defaultNumbers = ['1234567856'];
    const randomDefaultNumber = defaultNumbers[Math.floor(Math.random() * defaultNumbers.length)];
    this.form.controls['phone'].setValue(randomDefaultNumber);
    const testOTP = '123456';
    localStorage.setItem('defaultOTP', testOTP);

    // Set test mode flag so next signIn() call bypasses Firebase
    this.isInTestMode = true;

    // Show instructions about what was filled
    const alert = await this.alertController.create({
      header: await this.translate.get('TEST_MODE_ACTIVATED_TITLE').toPromise(),
      message: await this.translate.get('TEST_MODE_ACTIVATED_MESSAGE').toPromise() +
        `\n\n📱 ${await this.translate.get('PHONE').toPromise()}: +60${randomDefaultNumber}\n🔐 OTP: ${testOTP}\n\n` +
        await this.translate.get('TEST_MODE_NEXT_STEP').toPromise(),
      buttons: [
        {
          text: await this.translate.get('GOT_IT').toPromise(),
          handler: () => {
            // User can now see the filled form and click Continue button themselves
            // When they click Continue, isInTestMode flag will bypass Firebase
          }
        }
      ]
    });
    await alert.present();
  }

  async proceedWithTestMode(phoneNumber: string, testOTP: string) {
    // Use the correct test phone number
    const testPhoneNumber = '1234567856';

    // Create a PURE MOCK confirmation result - NO FIREBASE CALLS
    const mockConfirmationResult = {
      confirm: async (otp: string) => {
        console.log('🧪 Test mode: Verifying OTP:', otp);
        if (otp === testOTP) {
          // IMPORTANT: Don't call Firebase at all in test mode
          // Return a mock user structure that matches Firebase user
          console.log('✅ Test mode: OTP verified successfully');

          // For test mode, we need to actually authenticate with Firebase
          // but only ONCE when OTP is verified, not during initial SMS request
          try {
            this.overlay.showLoader('Signing in...');
            const fullPhoneNumber = '+60' + testPhoneNumber;
            // This is the ONLY Firebase call in test mode - when OTP is verified
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
        countryCode: '+60',
        confirmationResult: mockConfirmationResult,
        isTestMode: true
      },
      canDismiss: true
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();

    if (!data?.user) return;

    await this.navigateAfterLogin(data.user);
  }

  async handleAuthError(error: any) {
    let errorTitle = await this.translate.get('ERROR').toPromise();
    let errorMessage = '';

    switch (error.code) {
      case 'auth/invalid-phone-number':
        errorMessage = await this.translate.get('MOBILE_INVALID').toPromise();
        break;

      case 'auth/missing-phone-number':
        errorMessage = await this.translate.get('MOBILE_REQUIRED').toPromise();
        break;

      case 'auth/network-request-failed':
        errorMessage = await this.translate.get('NETWORK_ERROR').toPromise();
        break;

      case 'auth/too-many-requests':
        errorTitle = await this.translate.get('TOO_MANY_REQUESTS_TITLE').toPromise();
        errorMessage = await this.translate.get('TOO_MANY_REQUESTS').toPromise();
        break;

      case 'auth/invalid-app-credential':
      case 'auth/quota-exceeded':
        errorTitle = await this.translate.get('SMS_QUOTA_TITLE').toPromise();
        errorMessage = await this.translate.get('SMS_QUOTA_MESSAGE').toPromise();
        break;

      case 'auth/captcha-check-failed':
        errorTitle = await this.translate.get('CAPTCHA_FAILED_TITLE').toPromise();
        errorMessage = await this.translate.get('CAPTCHA_FAILED_MESSAGE').toPromise();
        break;

      case 'auth/operation-not-allowed':
        errorTitle = await this.translate.get('REGION_NOT_ALLOWED_TITLE').toPromise();
        errorMessage = await this.translate.get('REGION_NOT_ALLOWED_DETAIL').toPromise();
        break;

      case 'auth/unauthorized-domain':
        errorTitle = await this.translate.get('UNAUTHORIZED_DOMAIN_TITLE').toPromise();
        errorMessage = await this.translate.get('UNAUTHORIZED_DOMAIN_DETAIL').toPromise();
        break;

      default:
        errorMessage = `${await this.translate.get('SIGN_IN_ERROR').toPromise()} ${error.code || error.message || 'Unknown error'}`;
        break;
    }

    await this.overlay.showAlert(errorTitle, errorMessage);
  }

  async navigateAfterLogin(user: any) {
    try {
      console.log('Navigating after login for user:', user?.uid);

      if (!user || !user.uid) {
        console.error('Invalid user object, redirecting to details');
        this.router.navigateByUrl('/details', { replaceUrl: true });
        return;
      }

      // Check if user has a complete rider profile in the database
      const hasRiderProfile = await this.avatar.checkRiderProfile(user.uid);
      console.log('Has rider profile:', hasRiderProfile);

      if (hasRiderProfile) {
        // Existing rider with complete profile - go to home
        console.log('Existing rider detected, navigating to home');
        this.router.navigateByUrl('/home', { replaceUrl: true });
      } else {
        // New user or incomplete profile - go to details to complete account creation
        console.log('New user or incomplete profile, navigating to details');
        this.router.navigateByUrl('/details', { replaceUrl: true });
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
      // If error occurs, assume new user and redirect to details for safety
      this.router.navigateByUrl('/details', { replaceUrl: true });
    }
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

  updateFlag(countryCode: string) {
    const flagData = this.countryFlagService.getFlagWithFallback(countryCode);
    this.flag = flagData.url;
    this.flagEmoji = flagData.emoji;
    this.flagLoadError = false;
  }

  onFlagLoadError() {
    console.log('Flag image failed to load, using emoji fallback');
    this.flagLoadError = true;
  }

  private async getEmailAuthErrorMessage(error: any): Promise<string> {
    const code = error?.code;

    switch (code) {
      case 'auth/invalid-email':
        return await this.translate.get('EMAIL_INVALID').toPromise();
      case 'auth/user-disabled':
        return await this.translate.get('LOGIN_USER_DISABLED').toPromise();
      case 'auth/user-not-found':
        return await this.translate.get('LOGIN_USER_NOT_FOUND').toPromise();
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return await this.translate.get('LOGIN_WRONG_PASSWORD').toPromise();
      case 'auth/too-many-requests':
        return await this.translate.get('LOGIN_TOO_MANY_REQUESTS').toPromise();
      case 'auth/no-user':
        return await this.translate.get('LOGIN_GENERIC_ERROR').toPromise();
      default:
        return await this.translate.get('LOGIN_GENERIC_ERROR').toPromise();
    }
  }

  async detectUserCountry() {
    try {
      // Use native HTTP for better Android compatibility
      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const countryCode = data.country;
      const matchingCountry = this.CountryJson.find(
        country => country.isoCode === countryCode
      );
      if (matchingCountry) {
        this.CountryCode = matchingCountry.dialCode;
        this.numberT = matchingCountry.dialCode;
        this.userCountry = countryCode;
        this.updateFlag(countryCode);
      } else {
        // If country not found, keep Malaysia as default
        this.CountryCode = '+60';
        this.numberT = '+60';
        this.userCountry = 'MY';
        this.updateFlag('MY');
      }
    } catch (error) {
      console.error('Error detecting country:', error);
      // On error, ensure Malaysia defaults are set
      this.CountryCode = '+60';
      this.numberT = '+60';
      this.userCountry = 'MY';
      this.updateFlag('MY');
    }
  }
}
