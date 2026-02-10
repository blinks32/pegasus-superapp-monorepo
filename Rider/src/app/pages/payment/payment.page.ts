import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import { PaymentService } from '../../services/payment.service';
import { AvatarService } from '../../services/avatar.service';
import { Router } from '@angular/router';
import { Card } from 'src/app/interfaces/card';
import { TranslateService } from '@ngx-translate/core';

declare var Stripe: any;

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
})
export class PaymentPage implements OnInit, AfterViewInit {
  @ViewChild('cardElement', { static: false }) cardElement: ElementRef;
  paymentForm: FormGroup;
  loading: HTMLIonLoadingElement;
  stripe: any;
  elements: any;
  card: any;
  approve: boolean = false;
  cardInitialized: boolean = false;
  selectedProvider: string = '';
  savedPaymentMethods: Card[] = [];
  selectedCardId: string = '';
  defaultAmount: number = 1000;
  isCardComplete: boolean = false; // New state for card completion

  constructor(
    private fb: FormBuilder,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private paymentService: PaymentService,
    private avatarService: AvatarService,
    private translate: TranslateService
  ) {
    this.paymentForm = this.fb.group({
      provider: ['', Validators.required],
      cardId: [''],
      authCode: ['']
    });
  }

  ngOnInit() {
    this.fetchSavedPaymentMethods();
    this.onPaymentProviderChange('stripe');
    this.getActiveCard();
  }

  ngAfterViewInit() {}

  // Ensure Stripe card is initialized
  initializeStripeCard() {
    if (this.cardElement && this.cardElement.nativeElement) {
       this.stripe = Stripe('pk_test_51SShK5PRgzt7CIyewdombVyUyoBjYRQGrw8uBfWOF58l49mTcKZzWoeeyeBrjcsLT8NzCDKKjbwZQfDnNnpFzoxn00ivj0cGEe');

      //this.stripe = Stripe('pk_test_5Ee');
      this.elements = this.stripe.elements();
      if (!this.card) {
        this.card = this.elements.create('card');
        this.card.mount(this.cardElement.nativeElement);
        // Listen for changes on the card input
        this.card.on('change', event => {
          this.isCardComplete = event.complete;
        });
      }
      this.cardInitialized = true;
    }
  }

  onPaymentProviderChange(provider: string) {
    this.selectedProvider = provider;
    this.paymentForm.patchValue({ provider });

    if (provider === 'stripe') {
      setTimeout(() => {
        this.initializeStripeCard();
      }, 0);
    }
  }

  async fetchSavedPaymentMethods() {
    try {
      this.savedPaymentMethods = await this.avatarService.getSavedPaymentMethods();
      console.log('Saved Payment Methods:', this.savedPaymentMethods);
      if (this.savedPaymentMethods.length > 0) {
        this.selectedCardId = this.savedPaymentMethods[0].cardId; // Set default selected card
      }
    } catch (error) {
      console.error('Error fetching saved payment methods:', error);
    }
  }

  async getActiveCard() {
    const email = this.avatarService.user.email;
    this.avatarService.getActiveCard(email).subscribe((data: any) => {
      if (data && data.activeCardId) {
        this.selectedCardId = data.activeCardId;
      }
    });
  }

  async setActiveCard(event: any) {
    const cardId = event.detail.value;
    if (cardId) {
      try {
        const email = this.avatarService.user.email;
        await this.avatarService.setActiveCard(email, cardId);
        this.selectedCardId = cardId;
      } catch (error) {
        console.error('Error setting active card:', error);
      }
    }
  }

  async processPayment() {
    if (this.paymentForm.valid) {
      const formValues = this.paymentForm.value;
      formValues.email = this.avatarService.user.email; // Use email from avatarService
  
      this.showLoading();
  
      try {
        const cardData = await this.processStripePayment(formValues);

        console.log('Card added successfully:', cardData);
        await this.showAlert('Success', 'Card added successfully!');
        
        // Refresh the saved payment methods list to show the new card
        await this.fetchSavedPaymentMethods();
        
        // Clear the card input after successful addition
        if (this.card) {
          this.card.clear();
        }
  
      } catch (error) {
        console.error('Error adding card:', error);
        const errorMessage = error.error ? error.error.error : 'An unexpected error occurred.';
        await this.showAlert('Error', `Failed to add card: ${errorMessage}`);
      } finally {
        this.hideLoading();
        this.approve = false;
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

      // Validate clientSecret looks like a client secret (contains the secret part)
      if (!clientSecret) {
        console.error('No client_secret returned from server. Response:', setupIntentResponse);
        throw new Error('No client_secret returned from server for SetupIntent.');
      }
      // A client secret normally contains "_secret_"; if we only received an ID like 'seti_...'
      // that's likely the server returned the SetupIntent id instead of the client_secret.
      if (String(clientSecret).startsWith('seti_') && !String(clientSecret).includes('_secret_')) {
        console.error('Client secret looks like a SetupIntent ID (missing secret). Did the server return the ID instead of the client_secret?),', clientSecret);
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
        const errorElement = document.getElementById('card-errors');
        if (errorElement) {
          errorElement.textContent = error.message;
        }
        await this.showAlert('Payment Error', error.message);
        this.approve = false;
        console.error('Error confirming card setup:', error);
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
  
  async deletePaymentMethod(cardId: string) {
    const alert = await this.alertController.create({
      header: await this.translate.get('PAYMENT.DELETE_CARD').toPromise(),
      message: await this.translate.get('PAYMENT.DELETE_CARD_CONFIRM').toPromise(),
      buttons: [
        {
          text: await this.translate.get('PAYMENT.CANCEL').toPromise(),
          role: 'cancel'
        },
        {
          text: await this.translate.get('PAYMENT.DELETE').toPromise(),
          role: 'destructive',
          handler: async () => {
            try {
              await this.avatarService.deleteSavedPaymentMethod(cardId);
              await this.fetchSavedPaymentMethods();
              
              // If deleted card was selected, switch to another card or cash
              if (this.selectedCardId === cardId) {
                if (this.savedPaymentMethods.length > 0) {
                  this.selectedCardId = this.savedPaymentMethods[0].cardId;
                  await this.setActiveCard({ detail: { value: this.selectedCardId } });
                } else {
                  this.selectedCardId = '';
                }
              }
            } catch (error) {
              console.error('Error deleting payment method:', error);
              await this.showAlert('Error', 'Failed to delete card. Please try again.');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }

  async showLoading() {
    this.loading = await this.loadingController.create({
      message: await this.translate.get('PAYMENT.PROCESSING').toPromise(),
    });
    await this.loading.present();
  }

  async hideLoading() {
    if (this.loading) {
      await this.loading.dismiss();
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: await this.translate.get(header).toPromise(),
      message: await this.translate.get(message).toPromise(),
      buttons: ['OK'],
    });
    await alert.present();
  }

  changeLanguage(lang: string) {
    this.translate.use(lang);
  }
}
