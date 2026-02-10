import { Injectable } from '@angular/core';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class OverlayService {
  private loader: HTMLIonLoadingElement | null = null;
  isLoading = false;

  constructor(
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  async showLoader(message: string): Promise<HTMLIonLoadingElement> {
    // Always dismiss any existing loader first
    await this.hideLoader();
    
    this.isLoading = true;
    this.loader = await this.loadingCtrl.create({
      message: message,
      spinner: 'bubbles'
    });
    await this.loader.present();
    return this.loader;
  }

  async hideLoader() {
    this.isLoading = false;
    
    try {
      if (this.loader) {
        await this.loader.dismiss();
        this.loader = null;
      }
      
      // Force dismiss any lingering loaders
      const topLoader = await this.loadingCtrl.getTop();
      if (topLoader) {
        await topLoader.dismiss();
      }
    } catch (err) {
      console.log('Error dismissing loader:', err);
    }
  }

  async showToast(message: string, duration: number = 2000) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: duration,
      position: 'bottom'
    });
    await toast.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async showConfirmAlert(header: string, message: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Try Again',
            handler: () => resolve(true)
          }
        ]
      });
      
      await alert.present();
    });
  }
}
