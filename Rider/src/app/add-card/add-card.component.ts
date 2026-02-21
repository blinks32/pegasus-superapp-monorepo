import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PaymentService } from '../services/payment.service';
import { AvatarService } from '../services/avatar.service';
import { TranslateModule } from '@ngx-translate/core';

declare var Stripe: any;

@Component({
  selector: 'app-add-card',
  templateUrl: './add-card.component.html',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, TranslateModule]
})
export class AddCardComponent {
  @ViewChild('cardElement', { static: false }) cardElement: ElementRef;
  paymentForm: FormGroup;
  loading: HTMLIonLoadingElement;
  stripe: any;
  elements: any;
  card: any;
  isCardComplete: boolean = false;
  cardInitialized: boolean = false;

  constructor(
    private fb: FormBuilder,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private paymentService: PaymentService,
    private avatarService: AvatarService,
    private modalController: ModalController,
    private navController: NavController
  ) {
    this.paymentForm = this.fb.group({
      provider: ['stripe', Validators.required],
      cardId: [''],
      authCode: ['']
    });
  }

  ngOnInit() {
    // Initialize the form or any other needed data
  }

  ngAfterViewInit() {
    this.initializeStripeCard();
  }

  initializeStripeCard() {
    if (this.cardElement && this.cardElement.nativeElement) {
      this.stripe = Stripe('pk_test_51SShK5PRgzt7CIyewdombVyUyoBjYRQGrw8uBfWOF58l49mTcKZzWoeeyeBrjcsLT8NzCDKKjbwZQfDnNnpFzoxn00ivj0cGEe');
      this.elements = this.stripe.elements();
      if (!this.card) {
        this.card = this.elements.create('card');
        this.card.mount(this.cardElement.nativeElement);
        this.card.on('change', event => {
          this.isCardComplete = event.complete;
        });
      }
      this.cardInitialized = true;
    }
  }

  async processPayment() {
    if (this.paymentForm.valid) {
      const formValues = this.paymentForm.value;
      formValues.email = this.avatarService.user.email; // Use email from avatarService

      this.showLoading();

      try {
        const cardData = await this.processStripePayment(formValues);

        await this.modalController.dismiss({ success: true, cardData });
      } catch (error) {
        const errorMessage = error.message || (error.error ? error.error.error : 'An unexpected error occurred.');
        await this.showAlert('Error', errorMessage);
      } finally {
        this.hideLoading();
      }
    } else {
      this.showAlert('Form Error', 'Please fill out all required fields.');
    }
  }

  async processStripePayment(formValues) {
    console.log('Starting processStripePayment with formValues:', formValues);

    try {
      const setupIntentResponse = await this.paymentService.createSetupIntent(formValues.email).toPromise();
      console.log('Setup Intent raw response:', setupIntentResponse);
      const resp: any = setupIntentResponse;
      const clientSecret = resp && (resp.client_secret || resp.clientSecret || resp.clientSecretValue || resp.secret);
      console.log('Resolved clientSecret:', clientSecret);

      if (!clientSecret) {
        throw new Error('No client_secret returned from server for SetupIntent.');
      }

      if (String(clientSecret).startsWith('seti_') && !String(clientSecret).includes('_secret_')) {
        throw new Error('Invalid client_secret returned from server (looks like an ID). Ensure server returns the full client_secret.');
      }

      const { setupIntent, error } = await this.stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: this.card,
            billing_details: {
              email: formValues.email,
            },
          },
        }
      );

      if (error) {
        console.error('Stripe confirmCardSetup returned error object:', error);
        throw new Error(error.message);
      }

      console.log('Card setup confirmed:', setupIntent);

      const paymentMethodId = setupIntent.payment_method;

      // Fetch the payment method details from your server (which will call Stripe)
      const paymentMethod = await this.paymentService.retrievePaymentMethod(paymentMethodId).toPromise();
      console.log('Payment method retrieved:', paymentMethod);

      const cardDetails = paymentMethod.card;
      const last4 = cardDetails.last4;
      const brand = cardDetails.brand; // Get card brand (visa, mastercard, etc.)

      console.log('Checking if card exists with email:', formValues.email, ' and last4:', last4);
      const cardExists = await this.avatarService.checkCardExistsStripe(formValues.email, last4);

      if (cardExists) {
        throw new Error('This card is already saved to your account.');
      }

      // Save card to Firestore using the correct method
      const cardData = {
        cardId: paymentMethodId,
        email: formValues.email,
        last4: last4,
        brand: brand || 'unknown'
      };

      await this.avatarService.saveCard(cardData);
      console.log('Card saved to Firestore:', cardData);

      // Also save to backend if needed
      await this.paymentService.savePaymentMethod(formValues.email, paymentMethodId).toPromise();

      return cardData;

    } catch (error) {
      console.error('Error in processStripePayment:', error);
      throw error;
    }
  }

  async showLoading() {
    this.loading = await this.loadingController.create({ message: 'Processing payment...' });
    await this.loading.present();
  }

  async hideLoading() {
    if (this.loading) {
      await this.loading.dismiss();
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  closeModal() {
    this.modalController.dismiss();
  }
}
