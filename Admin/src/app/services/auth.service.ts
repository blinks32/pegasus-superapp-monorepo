import { Injectable } from '@angular/core';
import {
  Auth,
  signOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  GoogleAuthProvider,
  signInWithPopup,
  getAuth,
  linkWithCredential,
  unlink,
  fetchSignInMethodsForEmail,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword // Add this import
} from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  user$: Observable<User | null> = this.userSubject.asObservable();

  appVerifier: RecaptchaVerifier;
  confirmationResult: any;

  constructor(private auth: Auth) { }

  // Initialize the auth listener
  initAuthListener() {
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
    });
  }

  // Initialize RecaptchaVerifier
  recaptcha() {
    try {
      // Clear existing verifier if it exists
      if (this.appVerifier) {
        this.clearRecaptcha();
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
          console.log(response);
        },
        'expired-callback': () => {
          console.log('Recaptcha expired');
        }
      }, this.auth);

      // Only render on web platform
      if (typeof window !== 'undefined' && window.document && !window['Capacitor']) {
        this.appVerifier.render().catch(err => {
          console.warn('reCAPTCHA render error (likely already rendered):', err);
        });
      }
    } catch (error) {
      console.error('Error initializing RecaptchaVerifier:', error);
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
    }
  }

  async signInWithPhoneNumber(phoneNumber: string) {
    try {
      // Always ensure we have a verifier
      if (!this.appVerifier) {
        this.recaptcha();
      }
      const confirmationResult = await signInWithPhoneNumber(this.auth, phoneNumber, this.appVerifier);
      this.confirmationResult = confirmationResult;
      return confirmationResult;
    } catch (e) {
      console.error('Error in signInWithPhoneNumber:', e);
      throw e;
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
      throw (e?.message);
    }
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error in signInWithEmailAndPassword:', error);
      throw error;
    }
  }

  logout() {
    return signOut(this.auth);
  }
}
