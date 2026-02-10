import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  // Normalize serverUrl by removing any trailing slashes so concatenation
  // like `${this.serverUrl}/setup-intent` won't produce a double slash.
  private serverUrl = String(environment.serverUrl || '').replace(/\/\/+$|\/+$/g, '');

  constructor(private http: HttpClient) {}

  createSetupIntent(email: string) {
    return this.http.post<{ client_secret: string }>(`${this.serverUrl}/setup-intent`, { email });
  }

  savePaymentMethod(email: string, paymentMethodId: string) {
    return this.http.post<{ paymentMethodId: string }>(`${this.serverUrl}/save-payment-method`, { email, paymentMethodId });
  }

  retrievePaymentMethod(paymentMethodId: string) {
    return this.http.post<any>(`${this.serverUrl}/retrieve-payment-method`, { paymentMethodId });
  }

  checkCardExistsStripe(email: string, last4: string) {
    return this.http.post<{ exists: boolean }>(`${this.serverUrl}/check-card-exists`, { email, last4 });
  }

  payWithStripe(amount: number, currency: string, paymentMethodId: string, customerId: string) {
    return this.http.post<{ paymentIntent: any }>(`${this.serverUrl}/pay/stripe`, { amount, currency, paymentMethodId, customerId });
  }

  processPaymentWithCardId(email: string, amount: number, cardId: string): Observable<any> {
    return this.http.post('/api/process-payment', { email, amount, cardId });
  }

  // Process payment for ride with payment splitting
  processRidePayment(paymentData: {
    email: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    driverId: string;
    rideId: string;
    driverAmount: number;
    companyAmount: number;
  }): Observable<any> {
    return this.http.post(`${this.serverUrl}/process-ride-payment`, paymentData);
  }

  // Create a payment intent for immediate charge
  createPaymentIntent(paymentData: {
    email: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    description: string;
  }): Observable<any> {
    return this.http.post(`${this.serverUrl}/create-payment-intent`, paymentData);
  }

}
