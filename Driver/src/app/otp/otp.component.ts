import { Component, OnInit, OnDestroy, Input, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { OverlayService } from '../services/overlay.service';
import { NgOtpInputComponent } from 'ng-otp-input';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.component.html',
  styleUrls: ['./otp.component.scss'],
})
export class OtpComponent implements OnInit, OnDestroy {
  @Input() defaultOtp: string = '';
  @Input() phone: string = '';
  @Input() countryCode: string = '';
  @Input() confirmationResult: any;

  @ViewChild('otpInput') otpInput: NgOtpInputComponent;

  otp: string = '';
  countdown: number = 60;
  private countdownInterval: any;
  approve2: boolean = false;
  currentLanguage: string = 'en';
  textDir: string = 'ltr';

  constructor(
    private modalCtrl: ModalController,
    private auth: AuthService,
    private overlay: OverlayService,
    private translate: TranslateService,
    private languageService: LanguageService
  ) {
    this.currentLanguage = this.languageService.getLanguage() || 'en';
    this.setTextDirection();
  }

  ngOnInit() {
    this.startCountdown();
    if (this.defaultOtp) {
      setTimeout(() => {
        this.otpInput.setValue(this.defaultOtp);
        this.otp = this.defaultOtp;
      }, 0);
    }

    // Subscribe to language changes
    this.languageService.languageChange.subscribe(lang => {
      this.currentLanguage = lang;
      this.setTextDirection();
    });
  }

  ngOnDestroy() {
    this.stopCountdown();
  }

  private setTextDirection() {
    this.textDir = this.currentLanguage === 'ar' ? 'rtl' : 'ltr';
    document.dir = this.textDir;
  }

  startCountdown() {
    this.countdown = 60;
    this.stopCountdown(); // Clear any existing interval
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.stopCountdown();
      }
    }, 1000);
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  onOtpChange(otp: string) {
    this.otp = otp;
  }

  async resend() {
    if (this.countdown <= 0) {
      try {
        this.overlay.showLoader(await this.translate.get('RESENDING_OTP').toPromise());
        // Call your resend OTP method here
        this.overlay.hideLoader();
        this.overlay.showToast(await this.translate.get('OTP_RESENT').toPromise());
        this.startCountdown();
      } catch (error) {
        this.overlay.hideLoader();
        this.overlay.showAlert(
          await this.translate.get('ERROR').toPromise(),
          await this.translate.get('RESEND_FAILED').toPromise()
        );
      }
    }
  }

  async verifyOtp() {
    if (this.otp.length === 6) {
      this.approve2 = true;
      try {
        this.overlay.showLoader('');
        const userCredential = await this.confirmationResult.confirm(this.otp);
        if (userCredential.user) {
          this.overlay.hideLoader();
          this.modalCtrl.dismiss({ success: true });
        }
      } catch (error) {
        this.overlay.hideLoader();
        console.error('OTP verification error:', error);
        this.overlay.showAlert(
          await this.translate.get('ERROR').toPromise(),
          await this.translate.get('INVALID_OTP').toPromise()
        );
      } finally {
        this.approve2 = false;
        this.overlay.hideLoader();
      }
    } else {
      this.overlay.showAlert(
        await this.translate.get('ERROR').toPromise(),
        await this.translate.get('ENTER_VALID_OTP').toPromise()
      );
    }
  }

  closeModal() {
    this.modalCtrl.dismiss({ success: false });
  }

  changeLanguage(lang: string) {
    this.languageService.setLanguage(lang);
    this.translate.use(lang);
    this.currentLanguage = lang;
    this.setTextDirection();
  }
}
