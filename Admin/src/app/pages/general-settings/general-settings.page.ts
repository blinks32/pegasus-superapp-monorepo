import { Component, OnInit } from '@angular/core';
import { SettingsService, AppSettings } from '../../services/settings.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-general-settings',
  templateUrl: './general-settings.page.html',
  styleUrls: ['./general-settings.page.scss'],
})
export class GeneralSettingsPage implements OnInit {
  settings: AppSettings = {
    currency: 'USD',
    currencySymbol: '$'
  };

  currencies = [
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },

    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  ];

  constructor(
    private settingsService: SettingsService,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.settingsService.getSettings().subscribe(settings => {
      if (settings) {
        this.settings = { ...this.settings, ...settings };
      }
    });
  }

  async saveSettings() {
    try {
      const selectedCurrency = this.currencies.find(c => c.code === this.settings.currency);
      if (selectedCurrency) {
        this.settings.currencySymbol = selectedCurrency.symbol;
      }
      
      await this.settingsService.updateSettings(this.settings);
      
      const toast = await this.toastController.create({
        message: 'Settings saved successfully',
        duration: 2000,
        color: 'success'
      });
      toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Error saving settings: ' + error.message,
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }
  
  onCurrencyChange(event) {
      const selectedCode = event.detail.value;
      const selectedCurrency = this.currencies.find(c => c.code === selectedCode);
      if (selectedCurrency) {
          this.settings.currencySymbol = selectedCurrency.symbol;
      }
  }
}
