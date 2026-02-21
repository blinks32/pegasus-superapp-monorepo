import { Component, Input, OnInit, OnDestroy, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgOtpInputModule } from 'ng-otp-input';
import { Auth, PhoneAuthProvider, signInWithCredential } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';
import { OverlayService } from '../services/overlay.service';
import { AvatarService } from '../services/avatar.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.component.html',
  styleUrls: ['./otp.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, TranslateModule, NgOtpInputModule]
})
export class OtpComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() phone: string;
  @Input() countryCode: string;
  @Input() defaultOtp: string;  // New input property for default OTP
  @Input() confirmationResult: any;  // Add this input property

  isLoading = false;
  approve: boolean;
  approve2: boolean;
  otp: string;
  config = {
    length: 6,
    allowNumbersOnly: true,
  };
  countdown: number;
  countdownInterval: any;
  @ViewChild('otpInput') otpInput;  // Get reference to the ng-otp-input component

  constructor(
    public modalCtrl: ModalController,
    public overlay: OverlayService,
    public toastCtrl: ToastController,
    private auth: AuthService,
    private router: Router,
    private avatar: AvatarService,
    private cdr: ChangeDetectorRef,  // Inject ChangeDetectorRef
    private translate: TranslateService,
    private fireAuth: Auth
  ) { }

  ngOnInit() {
    console.log(this.phone);
    this.overlay.hideLoader();  // Hide all loaders when OTP page is called
    this.startCountdown(60);  // Start a 60-second countdown
  }

  ngAfterViewInit() {
    // Set the OTP input value after the view is initialized
    if (this.defaultOtp) {
      this.setOtp(this.defaultOtp);
      this.cdr.detectChanges();  // Manually trigger change detection
    }
  }

  ngOnDestroy() {
    clearInterval(this.countdownInterval);  // Clear the interval when the component is destroyed
  }

  onOtpChange(event) {
    this.otp = event;
    console.log(this.otp);
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  async resend(): Promise<void> {
    try {
      this.overlay.showLoader(await this.translate.get('RESENDING_OTP').toPromise());
      const response = await this.auth.signInWithPhoneNumber(this.countryCode + this.phone);
      console.log(response);
      this.confirmationResult = response;  // Update the confirmation result
      this.overlay.hideLoader();
      this.showToast(await this.translate.get('OTP_RESENT').toPromise());
      this.startCountdown(60);  // Restart the countdown when resending the OTP
    } catch (e) {
      console.error('Resend OTP error:', e);
      this.overlay.hideLoader();

      let errorMessage = await this.translate.get('RESEND_FAILED').toPromise();

      // Handle specific error codes
      if (e.code === 'auth/too-many-requests') {
        errorMessage = await this.translate.get('PLEASE_WAIT').toPromise();
      } else if (e.code === 'auth/network-request-failed') {
        errorMessage = await this.translate.get('NETWORK_ERROR').toPromise();
      }

      this.showToast(errorMessage);
    }
  }

  async verifyOtp(): Promise<void> {
    try {
      this.approve2 = true;
      this.overlay.showLoader('');

      let response;
      if (this.confirmationResult && this.confirmationResult.verificationId) {
        // Create credential using the verification ID and OTP code
        const credential = PhoneAuthProvider.credential(this.confirmationResult.verificationId, this.otp);
        // Sign in with the credential
        response = await signInWithCredential(this.fireAuth, credential);
      } else {
        // Fallback for test mode or if verificationId is missing
        response = await this.confirmationResult.confirm(this.otp);
      }

      // Wait briefly to ensure Firebase Auth state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.approve2 = false;
      this.overlay.hideLoader();
      this.modalCtrl.dismiss({ user: response.user });

    } catch (e) {
      console.error('OTP verification error:', e);
      this.clearOtpInput();
      this.overlay.hideLoader();
      this.approve2 = false;

      let errorMessage = await this.translate.get('INVALID_OTP').toPromise();

      // Handle specific error codes
      if (e.code === 'auth/invalid-verification-code') {
        errorMessage = await this.translate.get('INVALID_OTP').toPromise();
      } else if (e.code === 'auth/code-expired') {
        errorMessage = await this.translate.get('RESEND_OTP').toPromise();
      } else if (e.code === 'auth/network-request-failed') {
        errorMessage = await this.translate.get('NETWORK_ERROR').toPromise();
      } else if (e.code === 'auth/too-many-requests') {
        errorMessage = await this.translate.get('PLEASE_WAIT').toPromise();
      }

      this.showToast(errorMessage);
    } finally {
      // Ensure loader is always hidden, even if there's an unexpected error
      this.overlay.hideLoader();
      this.approve2 = false;
    }
  }

  async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom',
    });
    toast.present();
  }

  startCountdown(seconds: number) {
    this.countdown = seconds;
    clearInterval(this.countdownInterval);  // Clear any existing intervals
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  clearOtpInput() {
    this.otpInput.setValue('');  // Clear the value of ng-otp-input
    this.otp = '';  // Clear the OTP variable in the component
  }

  setOtp(otp: string) {
    this.otp = otp;
    this.otpInput.setValue(otp);  // Set the value in the ng-otp-input component
  }
}