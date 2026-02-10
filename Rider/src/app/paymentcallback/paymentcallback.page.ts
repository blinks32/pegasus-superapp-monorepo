import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-paymentcallback',
  templateUrl: './paymentcallback.page.html',
  styleUrls: ['./paymentcallback.page.scss'],
})
export class PaymentcallbackPage implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService
  ) {}

  statusMessage: string;
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const status = params['status'];
      this.statusMessage = this.getStatusMessage(status);
    });
  }

  getStatusMessage(status: string): string {
    switch (status) {
      case 'success':
        return 'Payment was successful!';
      case 'cancelled':
        return 'Payment was cancelled.';
      case 'failed':
        return 'Payment failed. Please try again.';
      default:
        return 'Payment status unknown.';
    }
  }

  goBack() {
    this.router.navigate(['/home']); // Replace with your desired route
  }

  changeLanguage(lang: string) {
    this.translate.use(lang);
    localStorage.setItem('language', lang);
  }
}