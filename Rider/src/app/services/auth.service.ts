import { Injectable } from '@angular/core';
import {
  Auth,
  signOut,
  signInWithPhoneNumber,
  signInWithPopup,
  getAuth,
  linkWithCredential,
  unlink,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword
} from '@angular/fire/auth';
import { RecaptchaVerifier, GoogleAuthProvider } from 'firebase/auth';
import { User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  appVerifier: RecaptchaVerifier;
  confirmationResult: any;
  user$: Observable<User | null>;
  private isRecaptchaInitialized = false;

  constructor(private auth: Auth) {
    this.user$ = new Observable<User | null>((subscriber) => {
      this.auth.onAuthStateChanged(subscriber);
    });
  }

  // Initialize RecaptchaVerifier
  recaptcha() {
    try {
      // Clear existing verifier if it exists
      if (this.appVerifier) {
        this.appVerifier.clear();
        this.appVerifier = null;
        this.isRecaptchaInitialized = false;
      }

      // Check if the container exists
      const container = document.getElementById('sign-in-button');
      if (!container) {
        console.error('reCAPTCHA container not found');
        return;
      }

      // Clear the container
      container.innerHTML = '';

      this.appVerifier = new RecaptchaVerifier('sign-in-button', {
        size: 'invisible',
        callback: (response) => {
          console.log('reCAPTCHA verified:', response);
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired, reinitializing...');
          this.isRecaptchaInitialized = false;
          this.recaptcha();
        }
      }, this.auth);

      this.appVerifier.render().then(() => {
        this.isRecaptchaInitialized = true;
        console.log('reCAPTCHA initialized successfully');
      }).catch((error) => {
        console.error('reCAPTCHA render error:', error);
        this.isRecaptchaInitialized = false;
      });
    } catch (error) {
      console.error('reCAPTCHA initialization error:', error);
      this.isRecaptchaInitialized = false;
    }
  }

  async signInWithPhoneNumber(phoneNumber: string) {
    try {
      // Ensure reCAPTCHA is initialized
      if (!this.appVerifier || !this.isRecaptchaInitialized) {
        console.log('🔄 reCAPTCHA not initialized, initializing now...');
        this.recaptcha();
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!this.appVerifier) {
        const error: any = new Error('reCAPTCHA not initialized');
        error.code = 'auth/captcha-check-failed';
        console.error('❌ reCAPTCHA initialization failed');
        throw error;
      }

      console.log('📱 Attempting to sign in with phone number:', phoneNumber);
      console.log('🔐 reCAPTCHA initialized:', this.isRecaptchaInitialized);
      console.log('🌐 Platform:', navigator.userAgent);
      
      const confirmationResult = await signInWithPhoneNumber(this.auth, phoneNumber, this.appVerifier);
      this.confirmationResult = confirmationResult;
      console.log('✅ Phone authentication successful');
      return confirmationResult;
    } catch (e) {
      // Comprehensive error logging
      console.error('═══════════════════════════════════════');
      console.error('❌ FIREBASE AUTHENTICATION ERROR');
      console.error('═══════════════════════════════════════');
      console.error('📱 Phone Number:', phoneNumber);
      console.error('🔴 Error Code:', e.code || 'NO_CODE');
      console.error('💬 Error Message:', e.message || 'NO_MESSAGE');
      console.error('📋 Full Error Object:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      console.error('🌐 User Agent:', navigator.userAgent);
      console.error('🔐 reCAPTCHA Status:', this.isRecaptchaInitialized);
      console.error('⏰ Timestamp:', new Date().toISOString());
      
      // Detailed error analysis
      if (e.code === 'auth/invalid-app-credential') {
        console.error('');
        console.error('🔴 CRITICAL: Invalid App Credential Error');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('This error means Firebase cannot verify your app.');
        console.error('');
        console.error('✅ SOLUTIONS FOR ANDROID:');
        console.error('1. Add SHA-1 fingerprint to Firebase Console');
        console.error('2. Add SHA-256 fingerprint to Firebase Console');
        console.error('3. Download new google-services.json');
        console.error('4. Replace old google-services.json');
        console.error('5. Rebuild app: ionic capacitor sync android');
        console.error('');
        console.error('📋 TO GET SHA FINGERPRINTS:');
        console.error('cd android && .\\gradlew signingReport');
        console.error('');
        console.error('🔗 Firebase Console:');
        console.error('https://console.firebase.google.com/project/pegasus-2be94/settings/general');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else if (e.code === 'auth/quota-exceeded' || e.code === 'auth/too-many-requests') {
        console.error('');
        console.error('⚠️ Quota/Rate Limit Error');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Possible causes:');
        console.error('1. SMS quota exceeded (check Firebase Console)');
        console.error('2. Too many requests from this device');
        console.error('3. Billing not enabled on Firebase project');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else if (e.code === 'auth/captcha-check-failed') {
        console.error('');
        console.error('🤖 reCAPTCHA Verification Failed');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Possible causes:');
        console.error('1. reCAPTCHA container not found in DOM');
        console.error('2. Network connectivity issues');
        console.error('3. Invalid Firebase configuration');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else if (e.code === 'auth/network-request-failed') {
        console.error('');
        console.error('🌐 Network Request Failed');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Check internet connectivity');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
      
      console.error('═══════════════════════════════════════');
      
      // Reset reCAPTCHA on error
      this.isRecaptchaInitialized = false;
      throw(e);
    }
  }

  clearRecaptcha() {
    if (this.appVerifier) {
      try {
        this.appVerifier.clear();
      } catch (error) {
        console.error('Error clearing reCAPTCHA:', error);
      }
      this.appVerifier = null;
      this.isRecaptchaInitialized = false;
    }
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    return signInWithPopup(auth, provider);
  }

  async linkGoogleAccount(user: User) {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        await linkWithCredential(user, credential);
      }
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use') {
        console.error('Error during Google sign-in: ', error);

        if (error.customData && error.customData.email) {
          const existingSignInMethods = await fetchSignInMethodsForEmail(this.auth, error.customData.email);
          if (existingSignInMethods.includes(GoogleAuthProvider.PROVIDER_ID)) {
            await unlink(this.auth.currentUser, GoogleAuthProvider.PROVIDER_ID);
            const result = await signInWithPopup(this.auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential) {
              await linkWithCredential(user, credential);
            }
          }
        } else {
          console.error('Missing email in error details: ', error);
        }
      } else {
        throw error;
      }
    }
  }

  async verifyOtp(otp: string) {
    try {
      if (!this.appVerifier) this.recaptcha();
      const result = await this.confirmationResult.confirm(otp);
      console.log(result);
      const user = result?.user;
      console.log(user);
    } catch (e) {
      throw(e?.message);
    }
  }

  logout() {
    return signOut(this.auth);
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential;
    } catch (error) {
      throw error;
    }
  }
}